import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const MAILPIT = "http://127.0.0.1:54324";

// QA round 4, iOS parents' phone (FPI_001–FPI_006): the parts that live on the website (local stack only).
test.setTimeout(240_000);

const phone = { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true };

async function signUp(page: Page, opts: { stopAtKids?: boolean } = {}) {
  const email = `qa4-${randomUUID().slice(0, 8)}@example.test`;
  const password = `qa4-${randomUUID()}`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  const home = `QA4 family ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Home name").fill(home);
  await page.getByRole("button", { name: /add your kids/ }).click();
  await page.getByLabel("Kid 1 name").fill("Pratham");
  if (opts.stopAtKids) return { email, password, home };
  await page.getByRole("button", { name: /pick chores/ }).click();
  await page.getByRole("button", { name: /the tablet/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/tablet/, { timeout: 30_000 });
  return { email, password, home };
}

async function resetLink(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
    for (const m of list.messages ?? []) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as { HTML: string };
      const link = /href="([^"]*type=recovery[^"]*)"/.exec(msg.HTML)?.[1];
      if (link) return link.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no reset email for ${to}`);
}

test("FPI_004: a reset link works in another browser than the one that asked for it", async ({ browser }) => {
  const asker = await (await browser.newContext(phone)).newPage();
  const { email } = await signUp(asker);
  await asker.context().clearCookies();
  // Asked from one browser (the app's in-app Safari)…
  await asker.goto("/reset");
  await asker.getByLabel("Email").fill(email);
  await asker.getByRole("button", { name: "Send reset link" }).click();
  await expect(asker.getByText(/reset link is on its way/)).toBeVisible();

  // …opened in another one (Mail / Safari), which has none of the first one's cookies.
  const link = await resetLink(email);
  const other = await (await browser.newContext(phone)).newPage();
  await other.goto(link);
  await expect(other).toHaveURL(/\/reset\/update$/);
  const field = other.getByLabel("New password");
  await expect(field).toBeEnabled();
  const fresh = `new-${randomUUID()}`;
  await field.fill(fresh);
  await other.getByRole("button", { name: /save/i }).click();
  await expect(other).toHaveURL(/\/admin/, { timeout: 30_000 });

  // The new password logs in.
  const login = await (await browser.newContext(phone)).newPage();
  await login.goto("/login");
  await login.getByLabel("Email").fill(email);
  await login.getByLabel("Password").fill(fresh);
  await login.getByRole("button", { name: /log in/i }).click();
  await expect(login).toHaveURL(/\/admin/, { timeout: 30_000 });

  // A used link says so right away, before anyone types a password.
  const again = await (await browser.newContext(phone)).newPage();
  await again.goto(link);
  await expect(again.getByText(/link expired/i)).toBeVisible();
  await expect(again.getByRole("link", { name: "Send reset link" })).toHaveAttribute("href", "/reset");
});

test("FPI_005 / FPI_006: chore date boxes side by side without touching; History's To can't go before From", async ({ browser }) => {
  const page = await (await browser.newContext(phone)).newPage();
  await signUp(page);
  await page.goto("/admin/chores");
  await page.locator("[draggable]").first().getByRole("button", { name: "Edit", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Edit chore" });
  const [from, until] = await Promise.all([
    sheet.getByLabel("Available from").boundingBox(),
    sheet.getByLabel("Available until").boundingBox(),
  ]);
  expect(until!.x - (from!.x + from!.width)).toBeGreaterThanOrEqual(12);
  expect(until!.x + until!.width).toBeLessThanOrEqual(375);
  await page.keyboard.press("Escape");

  await page.goto("/admin/history");
  const fromBox = page.getByLabel(/From/);
  const toBox = page.getByLabel(/To$/);
  await fromBox.fill("2026-10-28");
  await expect(toBox).toHaveAttribute("min", "2026-10-28");
  await toBox.fill("2026-10-16");
  await expect(toBox).toHaveValue("2026-10-28");
  await toBox.fill("2026-11-02");
  await fromBox.fill("2026-11-10");
  await expect(toBox).toHaveValue("2026-11-10");
  // A URL with the dates the wrong way round reads as the same range.
  await page.goto("/admin/history?from=2026-10-28&to=2026-10-16");
  await expect(fromBox).toHaveValue("2026-10-16");
  await expect(toBox).toHaveValue("2026-10-28");
});

test("FPI_001: currency picker with search, symbols and an A to Z index", async ({ browser }) => {
  const page = await (await browser.newContext(phone)).newPage();
  await signUp(page);
  await page.goto("/admin/settings");
  await page.getByTestId("currency-picker").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox").fill("rupee");
  await expect(dialog.getByRole("option", { name: /INR/ })).toBeVisible();
  await expect(dialog.getByRole("option", { name: /INR/ })).toContainText("₹");
  await dialog.getByRole("searchbox").fill("₹");
  await expect(dialog.getByRole("option", { name: /INR/ })).toBeVisible();
  await dialog.getByRole("searchbox").fill("");
  // The index jumps to a letter.
  await dialog.getByRole("button", { name: "I", exact: true }).click();
  await expect(page.locator("#cur-I")).toBeInViewport();
  await page.locator("#cur-I").click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("currency-picker")).toContainText(/^.*I[A-Z]{2}/);
});

test("FPI_002: back from Pick chores to Add your kids, Next still works (no stuck Saving…, no second kid)", async ({ browser }) => {
  const page = await (await browser.newContext(phone)).newPage();
  const { home } = await signUp(page, { stopAtKids: true });
  await page.getByRole("button", { name: /pick chores/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/chores/, { timeout: 30_000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/onboarding\/kids/);
  // The kid added before is listed (it wasn't: the page came back from memory).
  await expect(page.getByText("Pratham")).toBeVisible();
  const next = page.getByRole("button", { name: /pick chores/ });
  await expect(next).toBeEnabled();
  // Clear the empty row's name (there may be none) and go on.
  await next.click();
  await expect(page).toHaveURL(/\/onboarding\/chores/, { timeout: 30_000 });
  const { data: hh } = await admin.from("households").select("id").eq("name", home).single();
  const { count } = await admin.from("kids").select("id", { count: "exact", head: true }).eq("household_id", hh!.id);
  expect(count).toBe(1);
});

test("FPI_003: Add selected waits for the iPhone keyboard to finish closing before pinning again", async ({ browser }) => {
  const page = await (await browser.newContext(phone)).newPage();
  const { home } = await signUp(page);
  // Onboarding took every template: drop them so Add from templates has some to offer.
  const { data: hh } = await admin.from("households").select("id").eq("name", home).single();
  await admin.from("chores").delete().eq("household_id", hh!.id);
  await page.goto("/admin/chores");
  // The first tap can land before the page is ready.
  await expect(async () => {
    await page.getByRole("button", { name: /Add from templates/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass();
  const price = page.getByRole("dialog").getByRole("textbox").first();
  await price.click();
  await expect(page.locator("html")).toHaveAttribute("data-keyboard", "");
  // Pretend the keyboard is still on screen (iOS shrinks only the visible area) while focus leaves.
  await page.evaluate(() => {
    const vv = window.visualViewport!;
    Object.defineProperty(window, "innerHeight", { configurable: true, get: () => vv.height + 300 });
    (document.activeElement as HTMLElement).blur();
  });
  await page.waitForTimeout(200);
  await expect(page.locator("html")).toHaveAttribute("data-keyboard", "");
  // Keyboard gone: the bar pins again.
  await page.evaluate(() => {
    delete (window as { innerHeight?: number }).innerHeight;
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator("html")).not.toHaveAttribute("data-keyboard", "");
});
