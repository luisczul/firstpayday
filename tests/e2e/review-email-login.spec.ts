import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// "Ready for review" email: the one-click "Review now" link signs the parent in
// and lands on /admin/approvals; it is single-use; the opt-out toggle saves.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const email = `review-${randomUUID().slice(0, 8)}@example.test`;
const password = `review-${randomUUID()}`;
let kid: Page;

async function reviewLink(next = "/admin/approvals") {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  expect(error).toBeNull();
  return `/auth/confirm?token_hash=${encodeURIComponent(data.properties!.hashed_token)}&type=magiclink&next=${encodeURIComponent(next)}`;
}

test("setup: home, tablet, kid taps I did it", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill("Review mail family");
  await kid.getByLabel("Currency").selectOption("CAD");
  await kid.getByLabel("Language").selectOption("en");
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Liam");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();

  await kid.getByRole("button", { name: /Liam/ }).click();
  await expect(kid.getByRole("heading", { name: "Liam" })).toBeVisible({ timeout: 40_000 });
  await kid.getByRole("button", { name: "Garbage boss", exact: true }).click();
  const submitted = kid.waitForResponse((r) => r.url().includes("/api/kiosk/submit"));
  await kid.getByRole("button", { name: /I did it/ }).click();
  const res = await submitted;
  expect(res.status(), await res.text()).toBe(200);
  await expect(kid.getByText("Sent to Mom/Dad for checking!")).toBeVisible();
});

test("Review now signs the parent in and opens approvals; the link works once", async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const parent = await phone.newPage();
  const link = await reviewLink();
  await parent.goto(link);
  await expect(parent).toHaveURL(/\/admin\/approvals$/, { timeout: 45_000 });
  await expect(parent.getByText("Garbage boss").first()).toBeVisible();

  // Same link in a fresh browser: already used → login page, nothing signed in.
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  await expect(other).toHaveURL(/\/login\?error=link/);
  await other.goto("/admin/approvals");
  await expect(other).toHaveURL(/\/login/);
});

test("next is restricted to /admin paths", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(await reviewLink("//evil.example/admin"));
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/admin/, { timeout: 45_000 });
});

test("parent can turn review emails off and on", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(await reviewLink("/admin/settings"));
  await expect(page).toHaveURL(/\/admin\/settings$/, { timeout: 45_000 });
  const box = page.getByRole("checkbox", { name: /Email me when a chore is ready for review/ });
  await expect(box).toBeChecked();
  await box.uncheck();
  await expect(page.getByText("Review emails off")).toBeVisible();
  // This run's parent (family names repeat across runs).
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const me = users.users.find((x) => x.email === email)!;
  await expect
    .poll(async () => (await admin.from("household_members").select("review_emails_enabled").eq("user_id", me.id).single()).data?.review_emails_enabled)
    .toBe(false);
  await page.reload();
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(page.getByText("Review emails on")).toBeVisible();
});
