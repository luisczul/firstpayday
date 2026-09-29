import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Between admin pages, the tossed coin shows while the next page loads.
test("the coin loader shows between admin pages", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`coin-${randomUUID().slice(0, 8)}@example.test`);
  await page.getByLabel("Password").fill(`coin-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.getByLabel("Home name").fill("Coin family");
  await page.getByRole("button", { name: /add your kids/ }).click();
  await page.getByLabel("Kid 1 name").fill("Nora");
  await page.getByRole("button", { name: /pick chores/ }).click();
  await page.goto("/admin/approvals");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  // Slow down the next page's data so the loader has time to show.
  await page.route(/\/admin\/history/, async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.getByRole("link", { name: /History/ }).last().click();
  const loader = page.getByRole("status").filter({ hasText: "Counting your coins…" });
  await expect(loader).toBeVisible({ timeout: 5_000 });
  await expect(loader.locator("svg")).toHaveCount(2); // both faces of the coin
  if (process.env.COIN_SHOTS) {
    for (let i = 0; i < 3; i++) {
      await loader.screenshot({ path: `${process.env.COIN_SHOTS}/web-loader-${i}.png` });
      await page.waitForTimeout(250);
    }
  }
  await expect(page).toHaveURL(/\/admin\/history/, { timeout: 30_000 });
  await expect(loader).toBeHidden({ timeout: 30_000 });
  await ctx.close();
});
