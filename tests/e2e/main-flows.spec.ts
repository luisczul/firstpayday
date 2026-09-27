import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// The three main flows (SPEC §15): onboarding → kiosk, kid submits,
// parent reviews on a phone (send back → fixed → approve).

const email = `e2e-${randomUUID().slice(0, 8)}@example.test`;
const password = `e2e-${randomUUID()}`;

test.describe.configure({ mode: "serial" });

let tablet: BrowserContext;
let tabletPage: Page;

async function phone(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin\/approvals/);
  return { ctx, page };
}

test("1. a new parent sets up a household and a kids' tablet", async ({ browser }) => {
  tablet = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  tabletPage = await tablet.newPage();
  const page = tabletPage;
  const started = Date.now();

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();

  await expect(page.getByRole("heading", { name: /Name your home/ })).toBeVisible();
  await page.getByLabel("Home name").fill("E2E family");
  await page.getByLabel("Currency").selectOption("CAD");
  await page.getByRole("button", { name: /add your kids/ }).click();

  await expect(page.getByRole("heading", { name: /Add your kids/ })).toBeVisible();
  await page.getByLabel("Kid 1 name").fill("Mateo");
  await page.getByRole("button", { name: "+ Add another" }).click();
  await page.getByLabel("Kid 2 name").fill("Sofia");
  await page.getByRole("button", { name: /pick chores/ }).click();

  await expect(page.getByRole("heading", { name: /Pick your chores/ })).toBeVisible();
  await expect(page.getByText("20 chores selected")).toBeVisible();
  await page.getByRole("button", { name: /the tablet/ }).click();

  await page.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(page.getByRole("heading", { name: "Who's here?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mateo/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sofia/ })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3 * 60_000);
});

test("2. a kid taps their face, a card and “I did it!” without typing", async () => {
  const page = tabletPage;
  await page.getByRole("button", { name: /Mateo/ }).click();
  await expect(page.getByRole("heading", { name: "Mateo" })).toBeVisible();
  // No typing needed: the only text box is the optional chore search.
  await expect(page.locator("textarea, input:not([type=search])")).toHaveCount(0);

  await page.getByRole("button", { name: "Baseboards" }).click();
  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByText("= $4.00")).toBeVisible();
  await page.getByRole("button", { name: /I did it/ }).click();

  await expect(page.getByText("Sent to Mom/Dad for checking!")).toBeVisible();
  await expect(page.getByText("$4.00 waiting for check")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Waiting for check/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Baseboards" })).toHaveCount(0);

  // Whole-house chore: gone for the sibling too.
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: /Sofia/ }).click();
  await expect(page.getByRole("heading", { name: "Sofia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Baseboards" })).toHaveCount(0);
  await expect(page.getByText(/Back in 14 days/).first()).toBeVisible();
});

test("3. a parent on a phone sends it back, the kid fixes it, the parent approves", async ({ browser }) => {
  const { ctx, page } = await phone(browser);
  await expect(page.getByText("Baseboards")).toBeVisible();
  await page.getByRole("button", { name: /Send back/ }).click();
  await page.getByRole("button", { name: "Missed a spot" }).click();
  await page.getByRole("button", { name: "Send back", exact: true }).click();
  await expect(page.getByText("All caught up!")).toBeVisible();

  const kid = tabletPage;
  await kid.getByRole("button", { name: "Back" }).click();
  await kid.getByRole("button", { name: /Mateo/ }).click();
  await expect(kid.getByRole("heading", { name: /Needs fixing/ })).toBeVisible();
  await expect(kid.getByText("Missed a spot").first()).toBeVisible();
  await kid.locator("#needs-fixing").getByRole("button", { name: /Baseboards/ }).click();
  await kid.getByRole("button", { name: "Fixed it! 🔧", exact: true }).click();
  await expect(kid.locator("#needs-fixing")).toHaveCount(0);

  // Realtime: the phone's queue shows it again without a reload.
  await expect(page.getByText("FIXED")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Approve/ }).first().click();
  await expect(page.getByText("All caught up!")).toBeVisible();

  // Balance updates on the tablet (polling).
  await expect(kid.getByRole("button", { name: "My money" })).toContainText("$4.00 in my bank", { timeout: 10_000 });

  // A $3 payout reduces the balance.
  await page.goto("/admin/payouts");
  await page.getByLabel("Amount").fill("3");
  await page.getByRole("button", { name: "Record payout" }).click();
  await expect(page.getByText("Paid $3.00 to Mateo")).toBeVisible();
  await expect(kid.getByRole("button", { name: "My money" })).toContainText("$1.00 in my bank", { timeout: 10_000 });
  await ctx.close();
});
