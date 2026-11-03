import { expect, type Page } from "@playwright/test";

/** Picks the household currency in the currency sheet (search, then tap the row). */
export async function pickCurrency(page: Page, code: string) {
  const dialog = page.getByRole("dialog");
  // The first tap can land before the page is ready.
  await expect(async () => {
    await page.getByTestId("currency-picker").click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await dialog.getByRole("searchbox").fill(code);
  await dialog.getByRole("option", { name: new RegExp(`\\b${code}\\b`) }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("currency-picker")).toContainText(code);
}
