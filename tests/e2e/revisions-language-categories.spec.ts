import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Undo an approval → revision, per-kid French board, category filter, per-tablet stats (local stack only).
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const email = `rev-${randomUUID().slice(0, 8)}@example.test`;
const password = `rev-${randomUUID()}`;
let kid: Page;
let parent: Page;
const kidId: Record<string, string> = {};

async function openBoard(name: string) {
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: new RegExp(name) }).click();
  await expect(kid.getByRole("heading", { name })).toBeVisible({ timeout: 40_000 });
}

test("setup: home with Liam and Camila, tablet, Camila in French", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill("Rev family");
  await kid.getByLabel("Currency").selectOption("CAD");
  await kid.getByLabel("Language").selectOption("en");
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Liam");
  await kid.getByRole("button", { name: "+ Add another" }).click();
  await kid.getByLabel("Kid 2 name").fill("Camila");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();

  const { data: hh } = await admin.from("households").select("id").eq("name", "Rev family").order("created_at", { ascending: false }).limit(1).single();
  const { data: kids } = await admin.from("kids").select("id, name").eq("household_id", hh!.id);
  for (const k of kids ?? []) kidId[k.name] = k.id;

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  parent = await phone.newPage();
  await parent.goto("/login");
  await parent.getByLabel("Email").fill(email);
  await parent.getByLabel("Password").fill(password);
  await parent.getByRole("button", { name: "Log in" }).click();
  await expect(parent).toHaveURL(/\/admin/, { timeout: 45_000 });

  await parent.goto(`/admin/kids/${kidId.Camila}`);
  await parent.getByLabel("Board language").selectOption("fr");
  await parent.getByRole("button", { name: "Save", exact: true }).click();
  await expect(parent.getByText("Saved")).toBeVisible();
});

test("categories filter the board; Camila sees French", async () => {
  await openBoard("Liam");
  await kid.getByRole("button", { name: /Car & Garage/ }).click();
  await expect(kid.getByRole("button", { name: "Car mats & vacuum", exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Laundry manager", exact: true })).toHaveCount(0);
  await kid.getByRole("button", { name: /All/ }).first().click();
  await expect(kid.getByRole("button", { name: "Laundry manager", exact: true })).toBeVisible();

  // Price sort: cheapest first, then biggest first.
  // Routines have their own section; check the first regular chore section.
  const regular = kid.locator("main section", { hasNot: kid.getByRole("heading", { name: /routines/i }) }).first();
  const firstPrice = async () => Number((await regular.getByRole("button").first().innerText()).match(/\$(\d+(?:\.\d+)?)/)![1]);
  await kid.getByRole("button", { name: "Sort by price" }).click();
  expect(await firstPrice()).toBe(0.5); // Make your bed
  await kid.getByRole("button", { name: "Sort by price" }).click();
  expect(await firstPrice()).toBe(5);
  await kid.waitForTimeout(1500);
  await kid.screenshot({ path: "test-results/shots/kid-board.png" });
  await kid.getByRole("button", { name: "Sort by price" }).click();

  // Search, in the kid's language, ignoring accents.
  await kid.getByRole("searchbox").fill("laundry");
  await kid.getByRole("button", { name: /Search/ }).click();
  await expect(kid.getByRole("button", { name: "Laundry manager", exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Car mats & vacuum", exact: true })).toHaveCount(0);

  await openBoard("Camila");
  await expect(kid.getByRole("button", { name: "Tapis d'auto et aspirateur", exact: true })).toBeVisible();
  await kid.getByRole("searchbox").fill("tapis");
  await kid.getByRole("button", { name: /Chercher/ }).click();
  await expect(kid.getByRole("button", { name: "Tapis d'auto et aspirateur", exact: true })).toBeVisible();
  await kid.getByRole("searchbox").fill("zzz");
  await expect(kid.getByText(/Rien trouvé/)).toBeVisible();
  await kid.getByRole("searchbox").fill("");
  await expect(kid.getByRole("button", { name: /Auto et garage/ })).toBeVisible();
  await expect(kid.getByText("dans ma banque")).toBeVisible();
});

test("approve → undo as a revision → kid is notified, fixes it → approved again", async () => {
  await openBoard("Liam");
  await kid.getByRole("button", { name: "Garbage boss", exact: true }).click();
  await kid.getByRole("button", { name: /I did it/ }).click();
  await expect(kid.getByText("Sent to Mom/Dad for checking!")).toBeVisible();

  await parent.goto("/admin/approvals");
  await parent.getByRole("button", { name: /Approve/ }).first().click();
  await expect(parent.getByText("All caught up!")).toBeVisible();
  await expect.poll(async () => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", kidId.Liam!).single()).data?.balance_cents).toBe(100);

  // Double-checked: bins are still full.
  await parent.reload();
  const row = parent.locator("li", { hasText: "Garbage boss" });
  await row.getByRole("button", { name: "Undo…" }).click();
  await row.getByRole("button", { name: /Ask for a revision/ }).click();
  await row.getByPlaceholder("Type a note…").fill("Recycling bin is still inside");
  await row.getByRole("button", { name: "Send for revision" }).click();
  await expect(parent.getByText(/taken back/)).toBeVisible();
  await expect.poll(async () => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", kidId.Liam!).single()).data?.balance_cents).toBe(0);

  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await expect(kid.getByRole("button", { name: /Liam/ })).toContainText("🛠 1");
  await kid.getByRole("button", { name: /Liam/ }).click();
  await expect(kid.getByText("You have 1 to fix!")).toBeVisible();
  await expect(kid.getByText("Recycling bin is still inside").first()).toBeVisible();
  await kid.locator("#needs-fixing").getByRole("button", { name: /Garbage boss/ }).click();
  await kid.getByRole("button", { name: "Fixed it! 🔧", exact: true }).click();
  await expect(kid.getByRole("heading", { name: /Waiting for check/ })).toBeVisible();
  await expect(kid.locator("#needs-fixing")).toHaveCount(0);

  await parent.goto("/admin/approvals");
  await expect(parent.getByText("FIXED")).toBeVisible();
  await parent.getByRole("button", { name: /Approve/ }).first().click();
  await expect(parent.getByText("All caught up!")).toBeVisible();
  await expect.poll(async () => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", kidId.Liam!).single()).data?.balance_cents).toBe(100);
});

test("undo as a reversal: money out, no revision", async () => {
  await parent.reload();
  const row = parent.locator("li", { hasText: "Garbage boss" }).first();
  await row.getByRole("button", { name: "Undo…" }).click();
  await row.getByRole("button", { name: /Reverse/ }).click();
  await row.getByPlaceholder("Type a note…").fill("Dad did it in the end");
  await row.getByRole("button", { name: "Reverse approval" }).click();
  await expect(parent.getByText(/is reversed/)).toBeVisible();
  await expect.poll(async () => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", kidId.Liam!).single()).data?.balance_cents).toBe(0);
  const { data } = await admin.from("submissions").select("status").eq("kid_id", kidId.Liam!).single();
  expect(data?.status).toBe("reversed");
  // A reversed chore is back on the board straight away (no cooldown).
  await openBoard("Liam");
  await expect(kid.getByRole("button", { name: "Garbage boss", exact: true })).toBeVisible();
});

test("tablets page shows per-tablet usage; history shows the tablet", async () => {
  await parent.goto("/admin/settings/devices");
  const tablets = parent.getByRole("main").getByRole("list");
  await expect(tablets.getByRole("textbox", { name: "Tablet name" })).toHaveValue("Kitchen tablet");
  await expect(tablets.getByText(/Mostly Liam/)).toBeVisible();
  await parent.goto("/admin/history");
  await expect(parent.getByRole("columnheader", { name: "Tablet" })).toBeVisible();
  await expect(parent.getByRole("cell", { name: "Kitchen tablet" }).first()).toBeVisible();

  // CSV export honours its filters: only Camila's rows (she has none) vs everything.
  const all = await (await parent.request.get("/admin/history/export")).text();
  const camila = await (await parent.request.get(`/admin/history/export?kid=${kidId.Camila}`)).text();
  expect(all).toContain("Liam");
  expect(camila).not.toContain("Liam");
});

test("approve with a tip: price + tip land in the bank", async () => {
  await openBoard("Liam");
  await kid.getByRole("button", { name: "Car mats & vacuum", exact: true }).click();
  await kid.getByRole("button", { name: /I did it/ }).click();
  await expect(kid.getByText("Sent to Mom/Dad for checking!")).toBeVisible();

  await parent.goto("/admin/approvals");
  await parent.getByRole("button", { name: /^\+\s?\$1(\.00)?$/ }).first().click();
  await parent.getByRole("button", { name: /Approve \+ \$1(\.00)? tip/ }).click();
  await expect(parent.getByText("All caught up!")).toBeVisible();
  await expect.poll(async () => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", kidId.Liam!).single()).data?.balance_cents).toBe(300);
});

test("chore editor: numbers can be cleared and retyped, empty can't be saved", async () => {
  await parent.goto("/admin/chores");
  await parent.screenshot({ path: "test-results/shots/admin-chores-phone.png" });
  const card = parent.locator("div.flex.flex-col.gap-2", { has: parent.getByText("Laundry manager", { exact: true }) }).last();
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const qty = parent.getByRole("textbox", { name: "max quantity" });
  await qty.fill("");
  await expect(parent.getByRole("button", { name: "Save chore" })).toBeDisabled();
  await qty.fill("3");
  await parent.getByRole("button", { name: "More max quantity" }).click();
  await expect(qty).toHaveValue("4");
  await parent.getByRole("button", { name: "Every N days", exact: true }).last().click();
  const days = parent.getByRole("textbox", { name: "days", exact: true });
  // Long intervals are one tap away.
  for (const chip of ["60 days", "90 days", "Twice a year", "Yearly"]) await expect(parent.getByRole("button", { name: chip, exact: true })).toBeVisible();
  await parent.getByRole("button", { name: "Twice a year", exact: true }).click();
  await expect(days).toHaveValue("182");
  await days.fill("");
  await days.fill("60");
  await expect(days).toHaveValue("60");
  await parent.getByRole("button", { name: "Save chore" }).click();
  await expect.poll(async () => (await admin.from("chores").select("max_quantity, repeat_every_days").eq("title", "Laundry manager").order("created_at", { ascending: false }).limit(1).single()).data).toEqual({ max_quantity: 4, repeat_every_days: 60 });
});

test("kid photo: crop and zoom before saving", async () => {
  await parent.goto(`/admin/kids/${kidId.Liam}`);
  await parent.locator('input[type="file"]').setInputFiles("tests/fixtures/wide-photo.jpg");
  const dialog = parent.getByRole("dialog", { name: "Adjust photo" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Zoom in" }).click();
  await dialog.getByRole("button", { name: "Zoom in" }).click();
  const box = (await dialog.locator("div.touch-none").boundingBox())!;
  await parent.mouse.move(box.x + 140, box.y + 140);
  await parent.mouse.down();
  await parent.mouse.move(box.x + 60, box.y + 120, { steps: 5 });
  await parent.mouse.up();
  await dialog.getByRole("button", { name: "Use photo" }).click();
  await expect(dialog).toHaveCount(0);
  await parent.getByRole("button", { name: "Save", exact: true }).click();
  await expect(parent.getByText("Saved")).toBeVisible();
  await expect.poll(async () => (await admin.from("kids").select("avatar_path").eq("id", kidId.Liam!).single()).data?.avatar_path ?? null).not.toBeNull();
});

test("help & feedback: a parent sends the owners a message", async () => {
  await parent.goto("/admin/support");
  await parent.getByRole("radio", { name: /Something's broken/ }).click();
  await parent.getByLabel("Your message").fill("The sort button is great, but I'd love a dark mode.");
  await parent.getByRole("button", { name: "Send message" }).click();
  await expect(parent.getByText(/Thanks! Your message was sent/)).toBeVisible();
  await parent.reload();
  await expect(parent.getByText("The sort button is great, but I'd love a dark mode.")).toBeVisible();
  const { data } = await admin.from("support_messages").select("kind, email").eq("email", email).single();
  expect(data).toEqual({ kind: "bug", email });
});

test("kids' tablet: no way to log out, stays set up for a year, always returns to the board", async () => {
  await kid.goto("/kids");
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();
  // Nothing on the kids' screens signs the tablet out.
  await expect(kid.getByRole("button", { name: /log ?out|sign ?out|disconnect/i })).toHaveCount(0);
  await openBoard("Liam");
  await expect(kid.getByRole("button", { name: /log ?out|sign ?out|disconnect/i })).toHaveCount(0);

  // The tablet key lasts a year and is renewed on every visit.
  const expiry = async () => (await kid.context().cookies()).find((c) => c.name === "kiosk_token")!.expires * 1000;
  const first = await expiry();
  expect(first - Date.now()).toBeGreaterThan(360 * 86_400_000);
  await kid.waitForTimeout(1100);
  await kid.goto("/kids");
  expect(await expiry()).toBeGreaterThan(first);

  // Going to the home page on the tablet brings the kids back to "Who's here?".
  await kid.goto("/");
  await expect(kid).toHaveURL(/\/kids$/);
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();
});

test("cartoon avatar instead of a photo shows on the tablet", async () => {
  await parent.goto(`/admin/kids/${kidId.Camila}`);
  await parent.getByRole("button", { name: "Choose a picture" }).click();
  const sheet = parent.getByRole("dialog", { name: "Choose a picture" });
  await expect(sheet.getByRole("button")).toHaveCount(12 + 2); // 12 buddies + photo + cancel
  await sheet.getByRole("button", { name: "fox" }).click();
  await parent.getByRole("button", { name: "Save", exact: true }).click();
  await expect(parent.getByText("Saved")).toBeVisible();
  await expect.poll(async () => (await admin.from("kids").select("avatar_path").eq("id", kidId.Camila!).single()).data?.avatar_path).toBe("preset:fox");

  await kid.goto("/kids");
  await expect(kid.getByRole("button", { name: /Camila/ })).toContainText("🦊");
});


test("Make available now: a resting chore comes back on the board", async () => {
  // Car mats was approved earlier (every 14 days), so it's resting.
  await openBoard("Liam");
  await expect(kid.getByRole("button", { name: "Car mats & vacuum", exact: true })).toHaveCount(0);
  await parent.goto("/admin/chores");
  const card = parent.locator("div.flex.flex-col.gap-2", { has: parent.getByText("Car mats & vacuum", { exact: true }) }).last();
  await card.getByRole("button", { name: /Make available/ }).click();
  await expect(card.getByRole("button", { name: /Make available/ })).toHaveCount(0);
  await openBoard("Liam");
  await expect(kid.getByRole("button", { name: "Car mats & vacuum", exact: true })).toBeVisible();
});

test("a kid gives up a sent-back chore: it leaves Needs fixing and is free again", async () => {
  await openBoard("Liam");
  await kid.getByRole("button", { name: "Kitchen cabinets", exact: true }).click();
  await kid.getByRole("button", { name: /I did it/ }).click();
  await parent.goto("/admin/approvals");
  const item = parent.locator("li", { hasText: "Kitchen cabinets" }).filter({ hasNot: parent.getByRole("button", { name: "Undo…" }) });
  await item.getByRole("button", { name: /Send back/ }).click();
  await item.getByRole("button", { name: "Missed a spot" }).click();
  await item.getByRole("button", { name: "Send back", exact: true }).click();
  await expect(item).toHaveCount(0);

  await openBoard("Liam");
  await kid.locator("#needs-fixing").getByRole("button", { name: /Kitchen cabinets/ }).click();
  await kid.getByRole("button", { name: /remove this from my list/ }).click();
  await kid.getByRole("button", { name: "Yes, remove it" }).click();
  await expect(kid.getByText("Okay! It's off your list.")).toBeVisible();
  await expect(kid.locator("#needs-fixing")).toHaveCount(0);
  await expect(kid.getByRole("button", { name: "Kitchen cabinets", exact: true })).toBeVisible();
  // Free for a sibling too, and nothing was paid.
  await openBoard("Camila");
  await expect(kid.getByRole("button", { name: /Armoires de cuisine|Kitchen cabinets/ }).first()).toBeVisible();
  const { data } = await admin.from("submissions").select("status, amount_cents").eq("kid_id", kidId.Liam!).eq("chore_title_snapshot", "Kitchen cabinets").single();
  expect(data?.status).toBe("withdrawn");
});


test("Translate only shows when a kid reads another language than the home", async () => {
  // Camila was switched to French in setup: the chores page offers Translate.
  await parent.goto("/admin/chores");
  await expect(parent.getByRole("button", { name: /Translate all/ })).toBeVisible();
  // Back to the home language: nothing to translate, so no Translate buttons.
  await parent.goto(`/admin/kids/${kidId.Camila}`);
  await parent.getByLabel("Board language").selectOption("");
  await parent.getByRole("button", { name: "Save", exact: true }).click();
  await expect(parent.getByText("Saved")).toBeVisible();
  await parent.goto("/admin/chores");
  await expect(parent.getByRole("heading", { name: "Chores" })).toBeVisible();
  await expect(parent.getByRole("button", { name: /Translate/ })).toHaveCount(0);
  // Restore French for any later checks.
  await parent.goto(`/admin/kids/${kidId.Camila}`);
  await parent.getByLabel("Board language").selectOption("fr");
  await parent.getByRole("button", { name: "Save", exact: true }).click();
  await expect(parent.getByText("Saved")).toBeVisible();
});

test("approve at a corrected price (the chore was priced wrong)", async () => {
  const bal = async () => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", kidId.Liam!).single()).data?.balance_cents ?? 0;
  const start = await bal();
  await openBoard("Liam");
  await kid.getByRole("button", { name: "Sous-chef night", exact: true }).click();
  await kid.getByRole("button", { name: /I did it/ }).click();
  await expect(kid.getByText("Sent to Mom/Dad for checking!")).toBeVisible();
  // The parent fixes the chore's price after the kid submitted.
  await admin.from("chores").update({ price_cents: 100 }).eq("household_id", (await admin.from("kids").select("household_id").eq("id", kidId.Liam!).single()).data!.household_id).eq("title", "Sous-chef night");

  await parent.goto("/admin/approvals");
  const item = parent.locator("li", { hasText: "Sous-chef night" }).filter({ hasNot: parent.getByRole("button", { name: "Undo…" }) });
  await item.getByRole("button", { name: /Use today's price/ }).click();
  await expect(item.getByText("$1.00").first()).toBeVisible();
  await item.getByRole("button", { name: /Approve/ }).click();
  await expect.poll(bal).toBe(start + 100);
  const { data } = await admin.from("submissions").select("unit_price_cents, amount_cents").eq("kid_id", kidId.Liam!).eq("chore_title_snapshot", "Sous-chef night").single();
  expect(data).toEqual({ unit_price_cents: 100, amount_cents: 100 });
});
