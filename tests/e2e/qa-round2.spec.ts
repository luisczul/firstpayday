import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// QA round 2 (FP_012–FP_020, KT_001–KT_006): the parts that live on the website (local stack only).
test.setTimeout(240_000);

const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const APP_UA = "Mozilla/5.0 (Linux; Android 14) FirstPaydayApp/1.0.2 (Android)";

async function signUp(page: Page, opts: { home?: string; kids?: string[] } = {}) {
  const email = `qa2-${randomUUID().slice(0, 8)}@example.test`;
  const password = `qa2-${randomUUID()}`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  const home = opts.home ?? `QA2 family ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Home name").fill(home);
  await page.getByRole("button", { name: /add your kids/ }).click();
  const kids = opts.kids ?? ["Nora"];
  for (const [i, k] of kids.entries()) {
    if (i > 0) await page.getByRole("button", { name: "+ Add another" }).click();
    await page.getByLabel(`Kid ${i + 1} name`).fill(k);
  }
  await page.getByRole("button", { name: /pick chores/ }).click();
  await page.getByRole("button", { name: /the tablet/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/tablet/, { timeout: 30_000 });
  const { data: hh } = await admin.from("households").select("id").eq("name", home).single();
  return { email, password, home, householdId: hh!.id as string };
}

async function postWebSession(page: Page, fields: Record<string, string>) {
  await page.goto("/login");
  await page.evaluate((f) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/app/v1/web-session";
    for (const [k, v] of Object.entries(f)) {
      const i = document.createElement("input");
      i.name = k;
      i.value = v;
      form.appendChild(i);
    }
    document.body.appendChild(form);
    form.submit();
  }, fields);
}

async function appToken(browser: Browser, email: string, password: string) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post("/api/app/v1/auth/login", { data: { email, password } });
  expect(r.status()).toBe(200);
  const { accessToken } = await r.json();
  await ctx.close();
  return accessToken as string;
}

test("chores page: sort chevron inset, price saves with a spinner, empty state spacing, dates checked, Add selected flush", async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const { householdId } = await signUp(page);
  await page.goto("/admin/chores");

  // FP_013: the chevron sits inside the pill, away from its rounded edge.
  const select = page.getByLabel("Sort", { exact: true });
  const [box, chevron] = await Promise.all([select.boundingBox(), page.getByTestId("sort-chevron").boundingBox()]);
  expect(box!.x + box!.width - (chevron!.x + chevron!.width)).toBeGreaterThanOrEqual(12);
  await expect(select).toHaveCSS("appearance", "none");

  // FP_012: the new price shows right away with a spinner, then stays.
  const { data: chore } = await admin.from("chores").select("id, title, price_cents").eq("household_id", householdId).eq("active", true).order("sort_order").limit(1).single();
  const card = page.locator("[draggable]").filter({ hasText: chore!.title }).first();
  await card.getByTestId("chore-price-pill").click();
  const input = card.getByRole("textbox").first();
  await input.fill("7");
  // Slow the save down so the in-between state can be seen.
  await page.route("**/admin/chores", async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await card.getByRole("button", { name: "Save price" }).click();
  const pill = card.getByTestId("chore-price-pill");
  await expect(pill).toHaveAttribute("aria-busy", "true");
  await expect(pill).toContainText("7");
  await expect(pill).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
  await expect(pill).toContainText("7");
  await page.unroute("**/admin/chores");
  expect((await admin.from("chores").select("price_cents").eq("id", chore!.id).single()).data!.price_cents).toBe(700);

  // FP_015: "until" before "from" (or already over) is refused with a clear message, and the pickers start at today.
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Edit chore" });
  const from = sheet.getByLabel("Available from");
  const until = sheet.getByLabel("Available until");
  const d = new Date();
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const today = iso(d);
  await expect(from).toHaveAttribute("min", today);
  await expect(until).toHaveAttribute("min", today);
  const in5 = iso(new Date(d.getTime() + 5 * 86400_000));
  const in2 = iso(new Date(d.getTime() + 2 * 86400_000));
  await from.fill(in5);
  await expect(until).toHaveAttribute("min", in5);
  await until.fill(in2);
  await sheet.getByRole("button", { name: "Save chore" }).click();
  await expect(sheet.getByText("“Available until” must be the same day as “Available from” or later.")).toBeVisible();
  await until.fill(iso(new Date(d.getTime() - 3 * 86400_000)));
  await from.fill("");
  await sheet.getByRole("button", { name: "Save chore" }).click();
  await expect(sheet.getByText("“Available until” is already over. Pick today or a later day.")).toBeVisible();
  await page.keyboard.press("Escape");

  // FP_018: with no active chores, the empty box and the "Add chore" tile don't touch.
  await admin.from("chores").update({ active: false }).eq("household_id", householdId);
  await page.reload();
  const [empty, tile] = await Promise.all([page.getByTestId("chores-empty").boundingBox(), page.getByTestId("add-chore-tile").boundingBox()]);
  expect(tile!.y - (empty!.y + empty!.height)).toBeGreaterThanOrEqual(16);

  // FP_020: "Add selected" sits on the bottom edge of the templates sheet.
  await admin.from("chores").delete().eq("household_id", householdId);
  await page.reload();
  await page.getByRole("button", { name: /Add from templates/ }).first().click();
  const tpl = page.getByRole("dialog", { name: "Add from templates" });
  await expect(tpl).toBeVisible();
  const footer = tpl.getByTestId("template-picker-footer");
  await footer.scrollIntoViewIfNeeded();
  const [sheetBox, footerBox] = await Promise.all([tpl.boundingBox(), footer.boundingBox()]);
  expect(Math.abs(sheetBox!.y + sheetBox!.height - (footerBox!.y + footerBox!.height))).toBeLessThan(2);
  await ctx.close();
});

test("FP_016/FP_017: after kids mode on the phone app, parent pages don't show the web tab bar again", async ({ browser }) => {
  const web = await browser.newContext(phone);
  const { email, password } = await signUp(await web.newPage());
  await web.close();
  const token = await appToken(browser, email, password);

  const ctx = await browser.newContext({ ...phone, userAgent: APP_UA });
  const page = await ctx.newPage();
  // The app turns the phone into the kids' tablet, then the parent comes back (kiosk cookie left over).
  await postWebSession(page, { access_token: token, next: "/kids", mode: "kiosk" });
  await expect(page.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });
  expect((await ctx.cookies()).some((c) => c.name === "kiosk_token")).toBe(true);
  await postWebSession(page, { access_token: await appToken(browser, email, password), next: "/admin/settings" });
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 30_000 });
  expect((await ctx.cookies()).some((c) => c.name === "kiosk_token")).toBe(false);
  // No web tab bar, no web header (the app has its own).
  await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Kids Mode/ })).toHaveCount(0);
  await ctx.close();
});

test("FP_019: an invited parent who signs up without the email link can join; accepted invites leave the list", async ({ browser }) => {
  const ownerCtx = await browser.newContext(phone);
  const owner = await ownerCtx.newPage();
  const { householdId, home } = await signUp(owner);
  const invitee = `qa2-inv-${randomUUID().slice(0, 8)}@example.test`;
  await owner.goto("/admin/settings/members");
  await owner.getByLabel("Email").fill(invitee);
  await owner.getByRole("button", { name: "Send invite" }).click();
  await expect(owner.getByText(invitee)).toBeVisible({ timeout: 30_000 });

  // The co-parent creates an account on their own (e.g. in the app): onboarding offers the invite.
  const invCtx = await browser.newContext(phone);
  const inv = await invCtx.newPage();
  await inv.goto("/signup");
  await inv.getByLabel("Email").fill(invitee);
  await inv.getByLabel("Password").fill(`qa2-${randomUUID()}`);
  await inv.getByRole("checkbox").check();
  await inv.getByRole("button", { name: "Create my account" }).click();
  await expect(inv.getByText("You have an invitation")).toBeVisible({ timeout: 30_000 });
  await inv.getByRole("button", { name: `Join ${home}` }).click();
  await expect(inv).toHaveURL(/\/admin/, { timeout: 30_000 });
  const { data: members } = await admin.from("household_members").select("user_id").eq("household_id", householdId);
  expect(members!.length).toBe(2);

  // The owner's list: the co-parent is a member now, no Resend / Cancel.
  await owner.reload();
  await expect(owner.getByText(invitee)).toBeVisible();
  await expect(owner.getByRole("button", { name: /Resend/ })).toHaveCount(0);
  await expect(owner.getByText(/Parents \(2 of/)).toBeVisible();
  await ownerCtx.close();
  await invCtx.close();
});

test("kids' tablet: home name with a house, PIN dots per digit, unlock says which field is wrong, long names fit", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const longName = "Maximiliano Alejandro";
  const { email, householdId } = await signUp(page, { home: `..... ${randomUUID().slice(0, 4)}`, kids: [longName] });
  await page.goto("/admin/approvals");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Kids Mode/ }).first().click();
  await expect(page.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });

  // KT_001: the top-left is the home's name, shown with a house.
  await expect(page.getByTestId("home-name")).toContainText("🏠");

  // KT_006: one dot per digit typed.
  await admin.from("household_members").update({ pin_hash: "test-not-a-real-hash" }).eq("household_id", householdId);
  await page.getByRole("button", { name: /Parent/ }).click();
  await expect(page.getByText("Enter your PIN")).toBeVisible();
  await expect(page.getByTestId("pin-dot")).toHaveCount(4);
  for (const d of ["1", "2", "3", "4", "5"]) await page.getByRole("button", { name: d, exact: true }).click();
  await expect(page.getByTestId("pin-dot")).toHaveCount(5);

  // KT_002: the message names what's wrong.
  await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel("Email").fill("someone-else@example.test");
  await page.getByLabel("Password").fill("whatever-123");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("That email isn't a parent of this home. Check the email.")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Wrong password. Try again.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // KT_004: a long name is shortened; the sound and money buttons stay inside the screen.
  await page.getByRole("button", { name: new RegExp(longName) }).click();
  await expect(page.getByRole("heading", { name: longName })).toBeVisible({ timeout: 40_000 });
  const money = await page.getByRole("button", { name: "My money" }).boundingBox();
  expect(money!.x + money!.width).toBeLessThanOrEqual(800);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await ctx.close();
});
