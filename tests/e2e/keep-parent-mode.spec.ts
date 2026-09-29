import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Parent mode on the kids' tablet always starts with the timer and its bar; "Keep parent mode on" stops
// the timer and hides the bar until "Back to Kids Mode"; the next time parent mode starts, both are back.
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

// The same page runs in the website and inside both apps' kids'-tablet mode (their web views add
// "FirstPaydayApp/<version> (iOS|Android)" to the user agent): check all three.
const CLIENTS = [
  { name: "web", userAgent: undefined },
  { name: "Android app", userAgent: "Mozilla/5.0 (Linux; Android 16; Pixel 11 Pro Fold) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 FirstPaydayApp/1.0.0 (Android)" },
  { name: "iOS app", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FirstPaydayApp/1.0.0 (iOS)" },
];

for (const client of CLIENTS) test(`keep parent mode on (${client.name}): no timeout until Back to Kids Mode; the timer is the default again next time`, async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, ...(client.userAgent ? { userAgent: client.userAgent } : {}) });
  const tablet = await ctx.newPage();
  await tablet.goto("/signup");
  const email = `keep-${randomUUID().slice(0, 8)}@example.test`;
  const password = `keep-${randomUUID()}`;
  await tablet.getByLabel("Email").fill(email);
  await tablet.getByLabel("Password").fill(password);
  await tablet.getByRole("checkbox").check();
  await tablet.getByRole("button", { name: "Create my account" }).click();
  const home = `Keep family ${randomUUID().slice(0, 6)}`;
  await tablet.getByLabel("Home name").fill(home);
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
  const { data: hh } = await admin.from("households").select("id").eq("name", home).order("created_at", { ascending: false }).limit(1).single();
  await admin.from("households").update({ admin_timeout_minutes: 1 }).eq("id", hh!.id);

  // Turn this browser into the kids' tablet, then open parent mode with the PIN.
  if (!client.userAgent) {
    await tablet.goto("/admin/approvals");
    tablet.once("dialog", (d) => d.accept());
    await tablet.getByRole("button", { name: /Kids Mode/ }).first().click();
  } else {
    // The apps do it natively: More → "Use this device as the kids' tablet" = web-session with mode=kiosk.
    const session = await (await tablet.request.post("/api/app/v1/auth/login", { data: { email, password } })).json();
    await tablet.evaluate((token) => {
      const f = document.createElement("form");
      f.method = "POST";
      f.action = "/api/app/v1/web-session";
      for (const [k, v] of Object.entries({ access_token: token, mode: "kiosk" })) {
        const i = document.createElement("input");
        i.name = k;
        i.value = v;
        f.appendChild(i);
      }
      document.body.appendChild(f);
      f.submit();
    }, session.accessToken as string);
  }
  await expect(tablet.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });
  await enterParentMode(tablet);

  // Default: the timer is on.
  const bar = tablet.getByTestId("kiosk-parent-bar");
  await expect(bar).toContainText("Back to Kids Mode after 1 min without a tap.");

  // Keep parent mode on: the bar goes away; outlast the 1-minute timeout without touching anything.
  await bar.getByRole("button", { name: "Keep parent mode on" }).click();
  await expect(tablet.getByTestId("kiosk-parent-bar")).toHaveCount(0);
  await tablet.waitForTimeout(70_000);
  await expect(tablet).toHaveURL(/\/admin\/approvals/);
  await tablet.goto("/admin/kids");
  await expect(tablet).toHaveURL(/\/admin\/kids/);
  await expect(tablet.getByTestId("kiosk-parent-bar")).toHaveCount(0);

  // Leave with Back to Kids Mode: next time parent mode starts with the timer and the bar again.
  await tablet.getByRole("button", { name: /Back to Kids Mode/ }).click();
  await expect(tablet.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });
  await enterParentMode(tablet);
  await expect(tablet.getByTestId("kiosk-parent-bar")).toContainText("Back to Kids Mode after 1 min without a tap.");

  // And the timer really works again: after the minute, the tablet switches itself back to Kids Mode.
  await expect(tablet.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 90_000 });
  await expect(tablet).toHaveURL(/\/kids$/);
  await ctx.close();
});
