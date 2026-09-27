import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// "I'm on it!": claiming whole-house chores so siblings don't race (local stack only).
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const email = `clm-${randomUUID().slice(0, 8)}@example.test`;
const password = `clm-${randomUUID()}`;
let kid: Page;
let parent: Page;
let householdId = "";
const kidId: Record<string, string> = {};
const choreId: Record<string, string> = {};

async function openBoard(name: string) {
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: new RegExp(name) }).click();
  await expect(kid.getByRole("heading", { name })).toBeVisible({ timeout: 40_000 });
}

const card = (title: string) => kid.getByRole("button", { name: title, exact: true });
const inProgress = () => kid.locator("#in-progress");

async function claimFromBoard(title: string) {
  await card(title).first().click();
  await kid.getByRole("button", { name: "🙋 I'm on it!" }).click();
}

async function activeClaims(kidName: string) {
  const { data } = await admin
    .from("chore_claims")
    .select("id, chore_id, quantity, expires_at, released_at, release_reason, claimed_at")
    .eq("kid_id", kidId[kidName]!)
    .order("claimed_at", { ascending: false });
  return data ?? [];
}

const hoursLeft = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3_600_000;

test("setup: home with Liam and Camila, a tablet and a parent phone", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill("Claim family");
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

  const { data: hh } = await admin.from("households").select("id").eq("name", "Claim family").order("created_at", { ascending: false }).limit(1).single();
  householdId = hh!.id;
  const { data: kids } = await admin.from("kids").select("id, name").eq("household_id", householdId);
  for (const k of kids ?? []) kidId[k.name] = k.id;
  const { data: chores } = await admin.from("chores").select("id, title, claim_window").eq("household_id", householdId);
  for (const c of chores ?? []) choreId[c.title] = c.id;
  // Every chore starts with the 24-hour default.
  expect(new Set((chores ?? []).map((c) => c.claim_window))).toEqual(new Set(["24h"]));

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  parent = await phone.newPage();
  await parent.goto("/login");
  await parent.getByLabel("Email").fill(email);
  await parent.getByLabel("Password").fill(password);
  await parent.getByRole("button", { name: "Log in" }).click();
  await expect(parent).toHaveURL(/\/admin/, { timeout: 45_000 });
});

test("Liam claims Garage sweep: In progress comes first, with a countdown (24 h by default)", async () => {
  await openBoard("Liam");
  // Each-kid chores and routines don't offer a claim.
  await card("Make your bed").click();
  await expect(kid.getByRole("button", { name: /I did it/ })).toBeVisible();
  await expect(kid.getByRole("button", { name: "🙋 I'm on it!" })).toHaveCount(0);
  await kid.getByRole("button", { name: "Oops, not yet" }).click();

  await claimFromBoard("Garage sweep");
  await expect(kid.getByText("It's yours! Finish it before time runs out.")).toBeVisible();
  await expect(inProgress().getByRole("heading", { name: /In progress/ })).toBeVisible();
  // The very first section of the board.
  await expect(kid.locator("main section").first()).toHaveAttribute("id", "in-progress");
  const countdown = inProgress().getByTestId("claim-countdown");
  await expect(countdown).toContainText(/(23 h 5\d|24 h 0) min left/);
  await expect(countdown).toContainText(/until/);
  await kid.waitForTimeout(800);
  await kid.screenshot({ path: "test-results/shots/kid-claim-in-progress.png" });
  const [c] = await activeClaims("Liam");
  expect(hoursLeft(c!.expires_at)).toBeGreaterThan(23.9);
  expect(hoursLeft(c!.expires_at)).toBeLessThan(24.1);
});

test("Camila sees it locked and can't send it in", async () => {
  await openBoard("Camila");
  const locked = kid.getByTestId("claim-locked").filter({ hasText: "Liam is on it" });
  await expect(locked).toBeVisible();
  await expect(locked).toContainText(/until/);
  await locked.scrollIntoViewIfNeeded();
  await kid.screenshot({ path: "test-results/shots/kid-claim-locked.png" });
  await card("Garage sweep").click();
  await expect(kid.getByText("Liam is on this one. It comes back if time runs out!")).toBeVisible();
  await expect(kid.getByRole("dialog")).toHaveCount(0);

  // Even a direct request is refused.
  const res = await kid.request.post("/api/kiosk/submit", {
    data: { kidId: kidId.Camila, choreId: choreId["Garage sweep"], quantity: 1, idempotencyKey: randomUUID(), expectedLastId: null },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).reason).toBe("claimed");
});

test("Liam gives it back → Camila can take it", async () => {
  await openBoard("Liam");
  await inProgress().getByRole("button", { name: "Garage sweep" }).click();
  await kid.getByRole("button", { name: "Give it back" }).click();
  await expect(kid.getByText("Okay! Someone else can do it now.")).toBeVisible();
  await expect(inProgress()).toHaveCount(0);
  expect((await activeClaims("Liam"))[0]!.release_reason).toBe("given_back");

  await openBoard("Camila");
  await expect(kid.getByTestId("claim-locked")).toHaveCount(0);
  await claimFromBoard("Garage sweep");
  await expect(inProgress().getByRole("button", { name: "Garage sweep" })).toBeVisible();
});

test("Camila holds 2 claims; a 3rd is refused", async () => {
  await claimFromBoard("Clean the terrace 100%");
  await expect(inProgress().getByRole("button")).toHaveCount(2);
  await claimFromBoard("Clean the barbecue 100%");
  await expect(kid.getByText("You're already on 2 chores. Finish one first!")).toBeVisible();
  await expect(inProgress().getByRole("button")).toHaveCount(2);
});

test("a parent sees who's on it and releases a claim from the Chores page", async () => {
  await parent.goto("/admin/chores");
  const terrace = parent.locator("div.flex.flex-col.gap-2", { has: parent.getByText("Clean the terrace 100%", { exact: true }) }).last();
  await expect(terrace.getByText(/🙋 Camila is on it · until/)).toBeVisible();
  await terrace.getByRole("button", { name: "Release" }).click();
  await expect(terrace.getByText(/Camila is on it/)).toHaveCount(0);
  const { data } = await admin.from("chore_claims").select("release_reason").eq("chore_id", choreId["Clean the terrace 100%"]!).single();
  expect(data?.release_reason).toBe("parent");

  // Back on the board for everyone; Camila keeps Garage sweep.
  await openBoard("Camila");
  await expect(inProgress().getByRole("button")).toHaveCount(1);
  await expect(card("Clean the terrace 100%")).toBeVisible();
});

test("time runs out → the chore is free again and Liam gets a one-time nudge", async () => {
  await openBoard("Liam");
  await claimFromBoard("Car mats & vacuum");
  await expect(inProgress().getByRole("button", { name: "Car mats & vacuum" })).toBeVisible();
  const [c] = await activeClaims("Liam");
  await admin
    .from("chore_claims")
    .update({ claimed_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", c!.id);

  await openBoard("Liam");
  await expect(kid.getByText("⏰ Car mats & vacuum went back on the board")).toBeVisible();
  await expect(inProgress()).toHaveCount(0);
  await expect(card("Car mats & vacuum")).toBeVisible();
  expect((await activeClaims("Liam")).find((x) => x.id === c!.id)!.release_reason).toBe("expired");
  await kid.getByRole("button", { name: "OK", exact: true }).click();
  await expect(kid.getByText(/went back on the board/)).toHaveCount(0);
  // Only once.
  await openBoard("Liam");
  await expect(kid.getByRole("button", { name: /Car mats & vacuum/ }).first()).toBeVisible();
  await expect(kid.getByText(/went back on the board/)).toHaveCount(0);

  // Camila sees it free too.
  await openBoard("Camila");
  await expect(kid.getByTestId("claim-locked")).toHaveCount(0);
});

test("quantity: Liam takes 2 floors of Baseboards, does 1", async () => {
  await openBoard("Liam");
  // More than the chore allows is refused.
  const tooMany = await kid.request.post("/api/kiosk/claim", { data: { kidId: kidId.Liam, choreId: choreId.Baseboards, quantity: 4 } });
  expect(tooMany.status()).toBe(400);
  expect((await tooMany.json()).reason).toBe("invalid");

  await card("Baseboards").click();
  await kid.getByRole("button", { name: "More" }).click();
  await kid.getByRole("button", { name: "🙋 I'm on it!" }).click();
  const mine = inProgress().getByRole("button", { name: "Baseboards" });
  await expect(mine.getByTestId("claim-countdown")).toContainText("2 floors");
  expect((await activeClaims("Liam"))[0]!.quantity).toBe(2);

  await mine.click();
  await expect(kid.getByText("How many did you do?")).toBeVisible();
  const dialog = kid.getByRole("dialog");
  await expect(dialog.getByText("2", { exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: "More" })).toBeDisabled();
  await kid.getByRole("button", { name: "Less" }).click();
  await expect(dialog.getByText("1", { exact: true })).toBeVisible();
  await kid.getByRole("button", { name: /I did it/ }).click();
  await expect(kid.getByText("Sent to Mom/Dad for checking!")).toBeVisible();
  await expect(inProgress()).toHaveCount(0);
  await expect
    .poll(async () => (await admin.from("submissions").select("quantity, amount_cents").eq("chore_id", choreId.Baseboards!).maybeSingle()).data)
    .toEqual({ quantity: 1, amount_cents: 200 });
  const [done] = await activeClaims("Liam");
  expect(done!.release_reason).toBe("completed");
});

test("chore editor: time limit per chore, only for whole-house chores", async () => {
  await parent.goto("/admin/chores");
  const edit = async (title: string) => {
    const c = parent.locator("div.flex.flex-col.gap-2", { has: parent.getByText(title, { exact: true }) }).last();
    await c.getByRole("button", { name: "Edit", exact: true }).click();
  };
  const field = parent.getByLabel("Time to finish once a kid claims it");

  // Hidden for "each kid" chores and routines.
  for (const title of ["Make your bed", "Daily routine"]) {
    await edit(title);
    await expect(parent.getByRole("button", { name: "Save chore" })).toBeVisible();
    await expect(field).toHaveCount(0);
    await parent.keyboard.press("Escape");
    await expect(parent.getByRole("button", { name: "Save chore" })).toHaveCount(0);
  }

  await edit("Clean the barbecue 100%");
  await expect(field).toHaveValue("24h");
  // Switching to "each kid separately" hides it; back to whole house shows it again.
  const who = parent.getByLabel("Who can do it at a time?");
  await who.selectOption("per_kid");
  await expect(field).toHaveCount(0);
  await who.selectOption("household");
  await field.selectOption("2h");
  await parent.getByRole("button", { name: "Save chore" }).click();
  await expect(parent.getByRole("button", { name: "Save chore" })).toHaveCount(0);
  await expect.poll(async () => (await admin.from("chores").select("claim_window").eq("id", choreId["Clean the barbecue 100%"]!).single()).data?.claim_window).toBe("2h");

  await openBoard("Liam");
  await claimFromBoard("Clean the barbecue 100%");
  await expect(inProgress().getByTestId("claim-countdown")).toContainText(/(1 h 5\d|2 h 0) min left/);
  const [c] = await activeClaims("Liam");
  expect(hoursLeft(c!.expires_at)).toBeGreaterThan(1.95);
  expect(hoursLeft(c!.expires_at)).toBeLessThan(2.05);
});
