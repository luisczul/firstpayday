import { test } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Screenshots of every parent screen at iPhone size, for design review (local only).
const OUT = process.env.SHOTS_DIR ?? "test-results/phone-tour";

test("phone tour", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const shot = (n: string) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
  await p.goto("/"); await shot("01-landing");
  await p.goto("/pricing"); await shot("02-pricing");
  await p.goto("/signup"); await shot("03-signup");
  await p.getByLabel("Email").fill(`tour-${randomUUID().slice(0, 6)}@example.test`);
  await p.getByLabel("Password").fill(`tour-${randomUUID()}`);
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: "Create my account" }).click();
  await p.getByLabel("Home name").waitFor(); await shot("04-home");
  await p.getByLabel("Home name").fill("Tour family");
  await p.getByLabel("Currency").selectOption("CAD");
  await p.getByRole("button", { name: /add your kids/ }).click();
  await p.getByLabel("Kid 1 name").fill("Ana"); await shot("05-kids");
  await p.getByRole("button", { name: /pick chores/ }).click();
  await p.getByText("chores selected").waitFor(); await shot("06-chores");
  await p.getByRole("button", { name: /the tablet/ }).click();
  await p.getByText("Set up this tablet?").waitFor(); await shot("07-tablet");
  await p.getByRole("link", { name: /do it later/ }).click();
  for (const [n, path] of [["08-approvals", "/admin/approvals"], ["09-chores", "/admin/chores"], ["10-kids", "/admin/kids"], ["11-payouts", "/admin/payouts"], ["12-history", "/admin/history"], ["13-settings", "/admin/settings"], ["14-billing", "/admin/settings/billing"], ["15-tablets", "/admin/settings/devices"]] as const) {
    await p.goto(path); await p.waitForLoadState("networkidle"); await shot(n);
  }
});
