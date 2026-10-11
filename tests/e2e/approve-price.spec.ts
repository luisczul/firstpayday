import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// The chore's price was wrong: the parent corrects it on the approval card, for this submission
// and (optionally) for the chore from now on (local stack only).
test.setTimeout(240_000);

test("web approvals: edit the price, typed key by key, and keep it for the chore", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`price-${randomUUID().slice(0, 8)}@example.test`);
  await page.getByLabel("Password").fill(`price-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  const home = `Price family ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Home name").fill(home);
  await page.getByRole("button", { name: /add your kids/ }).click();
  await page.getByLabel("Kid 1 name").fill("Camila");
  await page.getByRole("button", { name: /pick chores/ }).click();
  await page.getByRole("button", { name: /the tablet/ }).click();
  const { data: hh } = await admin.from("households").select("id").eq("name", home).single();
  const { data: kid } = await admin.from("kids").select("id").eq("household_id", hh!.id).single();
  const { data: chore } = await admin
    .from("chores")
    .insert({ household_id: hh!.id, title: "Clean the BBQ furniture", emoji: "🍖", price_cents: 200, repeat_kind: "weekly", scope: "household" })
    .select("id")
    .single();
  const { data: sub } = await admin
    .from("submissions")
    .insert({ household_id: hh!.id, chore_id: chore!.id, kid_id: kid!.id, unit_price_cents: 200, amount_cents: 200, chore_title_snapshot: "Clean the BBQ furniture", status: "pending" })
    .select("id")
    .single();

  await page.goto("/admin/approvals");
  const card = page.locator("article, li, section, div").filter({ hasText: "Clean the BBQ furniture" }).filter({ has: page.getByRole("button", { name: /Approve/ }) }).last();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: "Edit the price" }).click();
  const price = card.getByLabel("Price", { exact: true });
  await price.click();
  await price.press("ControlOrMeta+a");
  await price.press("Backspace");
  await price.pressSequentially("0.75", { delay: 60 });
  await expect(price).toHaveValue("0.75");
  await expect(card.getByText("$0.75").first()).toBeVisible();
  await card.getByRole("checkbox", { name: /from now on/ }).check();
  await card.getByRole("button", { name: /Approve/ }).first().click();

  await expect
    .poll(async () => (await admin.from("submissions").select("status, unit_price_cents, amount_cents").eq("id", sub!.id).single()).data)
    .toEqual({ status: "approved", unit_price_cents: 75, amount_cents: 75 });
  expect((await admin.from("chores").select("price_cents").eq("id", chore!.id).single()).data!.price_cents).toBe(75);
  await ctx.close();
});
