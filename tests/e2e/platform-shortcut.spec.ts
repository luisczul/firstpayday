import { expect, test, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// The control panel shortcut appears only for the owner's account (email + platform admin).
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function userId(email: string, password: string): Promise<string> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const found = data.users.find((u) => u.email === email);
  if (found) {
    await admin.auth.admin.updateUserById(found.id, { password });
    return found.id;
  }
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return created.user.id;
}

async function signIn(browser: Browser, email: string, password: string, width: number) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  const onboarding = page.getByLabel("Home name");
  await expect(onboarding.or(page.getByRole("heading", { name: "Approvals" }))).toBeVisible({ timeout: 45_000 });
  if (await onboarding.isVisible()) {
    await page.getByLabel("Home name").fill("Home " + email.slice(0, 6));
    await page.getByRole("button", { name: /add your kids/ }).click();
    await page.getByLabel("Kid 1 name").fill("Nora");
    await page.getByRole("button", { name: /pick chores/ }).click();
  }
  await page.goto("/admin/approvals");
  await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible({ timeout: 30_000 });
  return page;
}

test("the owner sees the shortcut (sidebar on a computer, 🛠️ on a phone) and it opens the control panel", async ({ browser }) => {
  const password = `own-${randomUUID()}`;
  const id = await userId("luisczul@gmail.com", password);
  await admin.from("platform_admins").upsert({ user_id: id });

  const desk = await signIn(browser, "luisczul@gmail.com", password, 1280);
  await expect(desk.getByTestId("platform-shortcut")).toBeVisible();
  await desk.getByTestId("platform-shortcut").click();
  await expect(desk).toHaveURL(/\/platform$/);
  await expect(desk.getByRole("heading", { name: "First Payday · Platform" })).toBeVisible();

  const phone = await signIn(browser, "luisczul@gmail.com", password, 390);
  await expect(phone.getByTestId("platform-shortcut-mobile")).toBeVisible();
  await expect(phone.getByTestId("platform-shortcut")).toBeHidden();
});

test("any other parent, even a platform admin with another email, never gets it", async ({ browser }) => {
  const password = `oth-${randomUUID()}`;
  const email = `other-${randomUUID().slice(0, 8)}@example.test`;
  const id = await userId(email, password);
  await admin.from("platform_admins").upsert({ user_id: id });
  const page = await signIn(browser, email, password, 1280);
  await expect(page.getByTestId("platform-shortcut")).toHaveCount(0);
  await expect(page.getByTestId("platform-shortcut-mobile")).toHaveCount(0);
  expect(await page.content()).not.toContain('href="/platform"');
  await admin.from("platform_admins").delete().eq("user_id", id);

  const plainEmail = `plain-${randomUUID().slice(0, 8)}@example.test`;
  await userId(plainEmail, password);
  const plain = await signIn(browser, plainEmail, password, 1280);
  await expect(plain.getByTestId("platform-shortcut")).toHaveCount(0);
  expect(await plain.content()).not.toContain('href="/platform"');
});
