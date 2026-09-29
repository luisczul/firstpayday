import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Parent mode on the kids' tablet times out by default; "Keep parent mode on" stops the timer
// until "Back to Kids Mode", and the next time parent mode starts, the timer is back.
test.setTimeout(300_000);
const PIN = "4826";

async function enterParentMode(tablet: Page) {
  await tablet.goto("/kids");
  await tablet.waitForLoadState("networkidle");
  await tablet.getByRole("button", { name: /Parent/ }).click();
  await expect(tablet.getByText("Enter your PIN")).toBeVisible();
  for (const d of PIN) await tablet.getByRole("button", { name: d, exact: true }).click();
  await tablet.getByRole("button", { name: "✓" }).click();
  await expect(tablet).toHaveURL(/\/admin\/approvals/, { timeout: 30_000 });
}

test("keep parent mode on: no timeout until Back to Kids Mode; the timer is the default again next time", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const tablet = await ctx.newPage();
  await tablet.goto("/signup");
  await tablet.getByLabel("Email").fill(`keep-${randomUUID().slice(0, 8)}@example.test`);
  await tablet.getByLabel("Password").fill(`keep-${randomUUID()}`);
  await tablet.getByRole("checkbox").check();
  await tablet.getByRole("button", { name: "Create my account" }).click();
  await tablet.getByLabel("Home name").fill("Keep family");
  await tablet.getByRole("button", { name: /add your kids/ }).click();
  await tablet.getByLabel("Kid 1 name").fill("Nora");
  await tablet.getByRole("button", { name: /pick chores/ }).click();
  await tablet.getByRole("button", { name: /the tablet/ }).click();

  // A PIN for parent mode, then the shortest timeout (1 minute) so the test can outlast it.
  await tablet.goto("/admin/settings");
  await tablet.getByPlaceholder("Mom, Dad, Cami…").fill("Dad");
  await tablet.getByRole("button", { name: "Save", exact: true }).first().click();
  await tablet.getByPlaceholder("••••").fill(PIN);
  await tablet.getByRole("button", { name: "Set PIN" }).click();
  await expect(tablet.getByText("PIN set")).toBeVisible();
  const { data: hh } = await admin.from("households").select("id").eq("name", "Keep family").order("created_at", { ascending: false }).limit(1).single();
  await admin.from("households").update({ admin_timeout_minutes: 1 }).eq("id", hh!.id);

  // Turn this browser into the kids' tablet, then open parent mode with the PIN.
  await tablet.goto("/admin/approvals");
  tablet.once("dialog", (d) => d.accept());
  await tablet.getByRole("button", { name: /Kids Mode/ }).first().click();
  await expect(tablet.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });
  await enterParentMode(tablet);

  // Default: the timer is on.
  const bar = tablet.getByTestId("kiosk-parent-bar");
  await expect(bar).toContainText("Back to Kids Mode after 1 min without a tap.");

  // Keep parent mode on, then outlast the 1-minute timeout without touching anything.
  await bar.getByRole("button", { name: "Keep parent mode on" }).click();
  await expect(bar).toContainText("Parent mode stays on until you tap “Back to Kids Mode”.");
  await tablet.waitForTimeout(70_000);
  await expect(tablet).toHaveURL(/\/admin\/approvals/);
  await tablet.goto("/admin/kids");
  await expect(tablet).toHaveURL(/\/admin\/kids/);
  await expect(tablet.getByTestId("kiosk-parent-bar")).toContainText("Parent mode stays on");

  // Turn the timer back on: the bar says so.
  await tablet.getByRole("button", { name: "Turn the timer back on" }).click();
  await expect(tablet.getByTestId("kiosk-parent-bar")).toContainText("Back to Kids Mode after 1 min without a tap.");

  // Keep it on again, then leave: next time parent mode starts with the timer (the default).
  await tablet.getByRole("button", { name: "Keep parent mode on" }).click();
  await expect(tablet.getByTestId("kiosk-parent-bar")).toContainText("Parent mode stays on");
  await tablet.getByRole("button", { name: /Back to Kids Mode/ }).click();
  await expect(tablet.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });
  await enterParentMode(tablet);
  await expect(tablet.getByTestId("kiosk-parent-bar")).toContainText("Back to Kids Mode after 1 min without a tap.");

  // And the timer really works again: after the minute, the tablet switches itself back to Kids Mode.
  await expect(tablet.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 90_000 });
  await expect(tablet).toHaveURL(/\/kids$/);
  await ctx.close();
});
