import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Kid check-ins on the tablet -> parent stats; weekly report settings + preview (local stack only).
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const email = `chk-${randomUUID().slice(0, 8)}@example.test`;
const password = `chk-${randomUUID()}`;
let kid: Page;
let parent: Page;
let householdId = "";
let liamId = "";

async function openBoard(name: string) {
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: new RegExp(name) }).click();
  await expect(kid.getByRole("heading", { name })).toBeVisible({ timeout: 40_000 });
}

test("setup: home with Liam, tablet, parent phone", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill("Checkin family");
  await kid.getByLabel("Currency").selectOption("CAD");
  await kid.getByLabel("Language").selectOption("en");
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Liam");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();

  const { data: hh } = await admin.from("households").select("id").eq("name", "Checkin family").order("created_at", { ascending: false }).limit(1).single();
  householdId = hh!.id;
  const { data: k } = await admin.from("kids").select("id").eq("household_id", householdId).eq("name", "Liam").single();
  liamId = k!.id;

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  parent = await phone.newPage();
  await parent.goto("/login");
  await parent.getByLabel("Email").fill(email);
  await parent.getByLabel("Password").fill(password);
  await parent.getByRole("button", { name: "Log in" }).click();
  await expect(parent).toHaveURL(/\/admin/, { timeout: 45_000 });
});

test("tapping a kid twice shows 2 check-ins on the parent's kid page", async () => {
  await parent.goto(`/admin/kids/${liamId}`);
  await expect(parent.getByText("Hasn't opened the board yet")).toBeVisible();

  await openBoard("Liam");
  await openBoard("Liam");
  await expect
    .poll(async () => (await admin.from("kid_checkins").select("id", { count: "exact", head: true }).eq("kid_id", liamId)).count)
    .toBe(2);
  const { data: rows } = await admin.from("kid_checkins").select("device_id, household_id").eq("kid_id", liamId);
  expect(rows!.every((r) => r.device_id && r.household_id === householdId)).toBe(true);

  await parent.reload();
  await expect(parent.getByText(/2 check-ins · last/)).toBeVisible();
  await expect(parent.getByText("Last 7 days")).toBeVisible();

  await parent.goto("/admin/kids");
  await expect(parent.getByText(/2 check-ins in 7 days/)).toBeVisible();
});

test("weekly report day/hour and the per-parent opt-out save", async () => {
  await parent.goto("/admin/settings");
  await expect(parent.getByLabel("Weekly report day")).toHaveValue("6");
  await expect(parent.getByLabel("Weekly report hour")).toHaveValue("12");
  await parent.getByLabel("Weekly report day").selectOption("0");
  await parent.getByLabel("Weekly report hour").selectOption("9");
  await parent.getByRole("button", { name: "Save settings" }).click();
  await expect(parent.getByText("Saved", { exact: true })).toBeVisible();
  await parent.reload();
  await expect(parent.getByLabel("Weekly report day")).toHaveValue("0");
  await expect(parent.getByLabel("Weekly report hour")).toHaveValue("9");
  const { data: hh } = await admin.from("households").select("weekly_report_dow, weekly_report_hour").eq("id", householdId).single();
  expect(hh).toEqual({ weekly_report_dow: 0, weekly_report_hour: 9 });

  const box = parent.getByRole("checkbox", { name: /Email me the weekly report/ });
  await expect(box).toBeChecked();
  await box.uncheck();
  await expect(parent.getByText("Weekly report off")).toBeVisible();
  await parent.reload();
  await expect(parent.getByRole("checkbox", { name: /Email me the weekly report/ })).not.toBeChecked();
});

test("dev preview of the weekly report email", async () => {
  // Works on a dev server as-is, and on a production build with the cron secret.
  const res = await parent.request.get(`/api/cron/weekly-report?preview=${householdId}`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain("Your weekly report");
  expect(html).toContain("Liam");
  expect(html).toContain("/admin\"");
  expect(html).toContain("Sunday");

  // The real cron endpoint needs the secret.
  const cron = await parent.request.get("/api/cron/weekly-report");
  expect(cron.status()).toBe(401);
});
