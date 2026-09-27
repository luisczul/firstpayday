import { devices, expect, test } from "@playwright/test";

// "📲 Download app": one-tap install where the browser supports it, Apple's steps on iPhone/iPad.
test("Download app: install prompt when available, instructions otherwise (desktop Chrome)", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["Desktop Chrome"] });
  const page = await ctx.newPage();
  await page.goto("/");
  const btn = page.getByRole("button", { name: "Download app" });
  await expect(btn).toBeVisible();

  // No install event (e.g. Firefox/Safari desktop): generic steps.
  await btn.click();
  await expect(page.getByRole("dialog", { name: /home screen/i })).toContainText("Install app");
  await page.getByRole("button", { name: "Got it" }).click();

  // Chrome/Android: the page captured beforeinstallprompt → the button opens the real prompt.
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    (window as unknown as { __prompted: boolean }).__prompted = false;
    e.prompt = async () => {
      (window as unknown as { __prompted: boolean }).__prompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  await btn.click();
  expect(await page.evaluate(() => (window as unknown as { __prompted: boolean }).__prompted)).toBe(true);
  await expect(btn).toHaveCount(0); // installed → the button hides
  await ctx.close();
});

test("Download app on an iPhone shows Apple's Add to Home Screen steps (in French on /fr)", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("/fr");
  await page.getByRole("button", { name: "Télécharger l'app" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Sur l'écran d'accueil");
  // It covers the whole screen, above the header (not trapped inside the sticky header).
  expect(await dialog.evaluate((el) => el.parentElement === document.body && !el.closest("header"))).toBe(true);
  const box = (await dialog.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBe(0);
  expect(box.height).toBeGreaterThanOrEqual(vp.height - 1);
  const panel = (await dialog.getByRole("heading").boundingBox())!;
  expect(panel.y).toBeGreaterThan(vp.height / 3);
  await ctx.close();
});

test("the home-screen icon opens the right place: kids' board on a kids' tablet, parent admin otherwise", async ({ page, context }) => {
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.start_url).toBe("/start");
  await page.goto("/start");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  await context.addCookies([{ name: "kiosk_token", value: "any", url: page.url() }]);
  const res = await page.request.get("/start", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toMatch(/\/kids$/);
});
