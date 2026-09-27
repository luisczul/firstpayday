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

// Currency is chosen on its own: a Spanish-speaking home can use Swiss francs. Billing is hidden while free.
test("currency is independent of the language; billing page is hidden", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "es-MX" });
  const p = await ctx.newPage();
  const name = `Familia ${randomUUID().slice(0, 6)}`;
  await p.goto("/signup?lang=es");
  await p.getByLabel(/Correo/).fill(`cur-${randomUUID().slice(0, 8)}@example.test`);
  await p.getByLabel(/Contraseña/).fill(`cur-${randomUUID()}`);
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: /Crear/ }).click();
  await p.getByLabel(/Nombre del hogar/).fill(name);
  const currency = p.getByLabel(/Moneda/);
  await expect(currency.locator("optgroup")).toHaveCount(2);
  await expect(currency.locator('option[value="CHF"]')).toHaveText(/CHF · franco suizo/i);
  await currency.selectOption("CHF");
  await expect(p.getByLabel(/Idioma/)).toHaveValue("es");
  await p.getByRole("button", { name: /niños|hijos/i }).click();
  await expect(p).toHaveURL(/onboarding\/kids/);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.from("households").select("currency, locale").eq("name", name).single();
  expect(data).toEqual({ currency: "CHF", locale: "es" });

  await p.goto("/admin/settings/billing");
  await expect(p).toHaveURL(/\/admin\/settings$/);
  await expect(p.getByRole("link", { name: /Facturación|Billing/ })).toHaveCount(0);
});
