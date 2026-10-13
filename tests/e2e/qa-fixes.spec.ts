import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// QA round 1 (FP_001–FP_011), the parts that live on the website and server (local stack only).
test.setTimeout(240_000);

const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function signUpWithKid(page: Page, kidName = "Nora") {
  const email = `qa-${randomUUID().slice(0, 8)}@example.test`;
  const password = `qa-${randomUUID()}`;
  await page.goto("/signup");
  // FP_002: a space typed before the email is dropped, not rejected and not stored.
  await page.getByLabel("Email").fill(` ${email}`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  const home = `QA family ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Home name").fill(home);
  await page.getByRole("button", { name: /add your kids/ }).click();
  await page.getByLabel("Kid 1 name").fill(kidName);
  return { email, password, home };
}

test("FP_001/FP_002: login error points to sign-up; spaces around the email are trimmed (web and app API)", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`nobody-${randomUUID().slice(0, 6)}@example.test`);
  await page.getByLabel("Password").fill("whatever-123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("We couldn't log you in. Check your email and password. New here? Create an account first.")).toBeVisible();

  const email = `qa-api-${randomUUID().slice(0, 8)}@example.test`;
  const r = await request.post("/api/app/v1/auth/signup", { data: { email: `  ${email} `, password: "qa-password-123", acceptedTerms: true } });
  expect(r.status()).toBe(200);
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  expect(data.users.some((u) => u.email === email)).toBe(true);
});

test("FP_003/FP_007: the ✏️ badge on the kid picture is not cut by the circle", async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await signUpWithKid(page);
  const pick = page.getByRole("button", { name: "Choose a picture" }).first();
  const badge = pick.getByTestId("avatar-edit-badge");
  await expect(badge).toBeVisible();
  // Nothing between the badge and the button clips it.
  const clipped = await badge.evaluate((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (getComputedStyle(p).overflow !== "visible") return p.tagName;
      if (p.tagName === "BUTTON") return null;
    }
    return null;
  });
  expect(clipped).toBeNull();
  await ctx.close();
});

test("FP_005/FP_006/FP_009/FP_010: dates are labelled; bottom bars aren't pinned while typing; Back icon aligned", async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await signUpWithKid(page);
  await page.getByRole("button", { name: /pick chores/ }).click();

  // FP_006: the chore picker's bar is pinned, until a price is being typed.
  const pickerBar = page.getByTestId("template-picker-footer");
  await expect(pickerBar).toHaveCSS("position", "sticky");
  await page.getByLabel("Price").first().focus();
  await expect(pickerBar).toHaveCSS("position", "static");
  await page.getByLabel("Price").first().blur();
  await expect(pickerBar).toHaveCSS("position", "sticky");
  await pickerBar.getByRole("button", { name: /the tablet/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/tablet/, { timeout: 30_000 });

  // FP_010: "Add chore" sits flush with the bottom of the sheet, and isn't pinned while typing.
  await page.goto("/admin/chores");
  await page.getByRole("button", { name: "+ New chore" }).click();
  await page.getByRole("button", { name: /Start from a template/ }).click();
  // FP_009: the Back arrow is an icon centred with the word.
  const back = page.getByRole("dialog", { name: "Choose a template" }).getByRole("button", { name: "Back", exact: true });
  const [icon, word] = await Promise.all([back.locator("svg").boundingBox(), back.locator("span").boundingBox()]);
  expect(Math.abs(icon!.y + icon!.height / 2 - (word!.y + word!.height / 2))).toBeLessThan(2);
  await back.click();
  await page.getByRole("button", { name: /Start from blank/ }).click();
  const sheet = page.getByRole("dialog", { name: "New chore" });
  const footer = sheet.getByTestId("chore-editor-footer");
  // The Title is focused when the sheet opens (keyboard up): not pinned.
  await expect(footer).toHaveCSS("position", "static");
  // Keyboard closed: pinned, flush with the bottom of the sheet.
  await sheet.getByLabel("Title").blur();
  await expect(footer).toHaveCSS("position", "sticky");
  const [sheetBox, footerBox] = await Promise.all([sheet.boundingBox(), footer.boundingBox()]);
  expect(Math.abs(sheetBox!.y + sheetBox!.height - (footerBox!.y + footerBox!.height))).toBeLessThan(2);
  await page.keyboard.press("Escape");

  // FP_005: History's date filters have visible labels.
  await page.goto("/admin/history");
  await expect(page.getByText("📅 From")).toBeVisible();
  await expect(page.getByText("📅 To")).toBeVisible();
  await expect(page.getByLabel("From")).toHaveAttribute("type", "date");
  await ctx.close();
});
