import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();

// Regression: the timezone the parent picks is exactly what gets saved (local stack only).
test("onboarding saves the chosen timezone, currency and language", async ({ browser }) => {
  const ctx = await browser.newContext({ timezoneId: "America/Los_Angeles", locale: "en-US" });
  const p = await ctx.newPage();
  const email = `tz-${randomUUID().slice(0, 8)}@example.test`;
  await p.goto("/signup");
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Password").fill(`tz-${randomUUID()}`);
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: "Create my account" }).click();
  await p.getByLabel("Home name").fill("TZ family");
  // Browser says Los Angeles; the parent picks New York, CAD, English.
  await expect(p.getByLabel("Timezone")).toHaveValue("America/Los_Angeles");
  await p.getByLabel("Timezone").selectOption("America/New_York");
  await p.getByLabel("Currency").selectOption("CAD");
  await p.getByLabel("Language").selectOption("en");
  await p.getByRole("button", { name: /add your kids/ }).click();
  await expect(p.getByRole("heading", { name: /Add your kids/ })).toBeVisible();

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.from("households").select("timezone, currency, locale").eq("name", "TZ family").order("created_at", { ascending: false }).limit(1).single();
  expect(data).toEqual({ timezone: "America/New_York", currency: "CAD", locale: "en" });

  // Going back to step 1 keeps the saved values (no silent reset to the browser's zone).
  await p.goto("/onboarding/home");
  await expect(p.getByLabel("Timezone")).toHaveValue("America/New_York");
});
