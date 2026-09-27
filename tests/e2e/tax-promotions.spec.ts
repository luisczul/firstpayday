import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Family tax (turned on at onboarding's last step) and a live +$1 promotion (local stack only).
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const email = `tax-${randomUUID().slice(0, 8)}@example.test`;
const password = `tax-${randomUUID()}`;
let kid: Page;
let parent: Page;
let householdId = "";
let noraId = "";

const balance = async () => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", noraId).single()).data?.balance_cents;

async function openBoard() {
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: /Nora/ }).click();
  await expect(kid.getByRole("heading", { name: "Nora" })).toBeVisible({ timeout: 40_000 });
}

test("setup: family tax turned on at the last onboarding step", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill("Tax family");
  await kid.getByLabel("Currency").selectOption("CAD");
  await kid.getByLabel("Language").selectOption("en");
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Nora");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  await kid.getByRole("button", { name: /the tablet/ }).click();

  // Last step: optional family tax, explained for the parent.
  await expect(kid.getByText(/Want to teach taxes too/)).toBeVisible({ timeout: 30_000 });
  await expect(kid.getByText(/part of every paycheck goes to things everyone shares/)).toBeVisible();
  await kid.getByLabel("Turn on family tax").check();
  await expect(kid.getByRole("alert").filter({ hasText: "Saved" })).toBeVisible();
  await expect(kid.getByText(/paying out \$10\.00 at 10% gives \$9\.00 in hand and \$1\.00 to the family pot/)).toBeVisible();

  const { data: hh } = await admin.from("households").select("id, tax_enabled, tax_percent").eq("name", "Tax family").order("created_at", { ascending: false }).limit(1).single();
  expect(hh).toMatchObject({ tax_enabled: true, tax_percent: 10 });
  householdId = hh!.id;
  const { data: k } = await admin.from("kids").select("id").eq("household_id", householdId).eq("name", "Nora").single();
  noraId = k!.id;

  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  parent = await phone.newPage();
  await parent.goto("/login");
  await parent.getByLabel("Email").fill(email);
  await parent.getByLabel("Password").fill(password);
  await parent.getByRole("button", { name: "Log in" }).click();
  await expect(parent).toHaveURL(/\/admin/, { timeout: 45_000 });
});

test("a +$1 promotion: banner on the tablet, bonus paid on approval", async () => {
  await parent.goto("/admin/settings/promotions");
  await parent.getByLabel("Name").fill("Saturday blitz");
  await parent.getByRole("textbox", { name: /^Amount/ }).fill("1.00");
  await parent.getByRole("button", { name: "Create promotion" }).click();
  await expect(parent.getByText("Live now")).toBeVisible();
  await expect(parent.getByText(/\+\$1 per chore/).first()).toBeVisible();

  await openBoard();
  await expect(kid.getByText("+$1 on every chore until", { exact: false })).toBeVisible();
  await expect(kid.getByText(/Ends in \d/)).toBeVisible();
  const card = kid.getByRole("button", { name: "Garbage boss", exact: true });
  await expect(card.getByText("+$1 bonus")).toBeVisible();
  await kid.waitForTimeout(500);
  await kid.screenshot({ path: "test-results/shots/promo-board.png" });
  await card.click();
  await kid.getByRole("button", { name: /I did it/ }).click();
  await expect(kid.getByText("Sent to Mom/Dad for checking!")).toBeVisible();

  await parent.goto("/admin/approvals");
  await expect(parent.getByTestId("promo-bonus")).toHaveText(/\+ \$1\.00 Saturday blitz/);
  await parent.getByRole("button", { name: /Approve/ }).first().click();
  await expect(parent.getByText("All caught up!")).toBeVisible();
  await expect.poll(balance).toBe(200); // $1 chore + $1 promotion
  const { data: rows } = await admin.from("ledger_entries").select("kind, amount_cents, note").eq("kid_id", noraId).order("created_at");
  expect(rows?.map((r) => [r.kind, r.amount_cents])).toEqual([["earning", 100], ["promo", 100]]);
});

test("payout shows gross / tax / net and withholds the family tax", async () => {
  await parent.goto("/admin/payouts");
  const breakdown = parent.getByLabel("Payout breakdown");
  await expect(breakdown).toContainText("Taken from balance");
  await expect(breakdown).toContainText("$2.00");
  await expect(breakdown).toContainText("Family tax (10%)");
  await expect(breakdown).toContainText("$0.20");
  await expect(breakdown).toContainText("In hand");
  await expect(breakdown).toContainText("$1.80");
  await parent.getByRole("button", { name: "Pay $1.80 to Nora" }).click();
  await expect(parent.getByText("Paid $1.80 to Nora ($0.20 family tax)")).toBeVisible();
  await expect.poll(balance).toBe(0);
  await parent.reload();
  await expect(parent.getByTestId("family-pot")).toHaveText("$0.20");
  await expect(parent.getByText(/Spend it on something the whole family shares/)).toBeVisible();

  await openBoard();
  await kid.getByRole("button", { name: "My money" }).click();
  const taxes = kid.getByTestId("kid-taxes");
  await expect(taxes).toContainText("Taxes paid so far: $0.20");
  // Since the start: everything earned stays visible after the payout (bank $0 + paid $1.80 + tax $0.20).
  const lifetime = kid.getByTestId("kid-lifetime");
  await expect(lifetime).toContainText("Earned since the start");
  await expect(lifetime).toContainText("$2.00");
  await expect(lifetime).toContainText("Paid to me");
  await expect(lifetime).toContainText("$1.80");
  await expect(taxes).toContainText("ice-cream outing");
  await expect(kid.getByRole("dialog")).toContainText("Family tax");
  await expect(kid.getByRole("dialog")).toContainText("Special bonus: Saturday blitz");
  await kid.screenshot({ path: "test-results/shots/kid-taxes.png" });
});
