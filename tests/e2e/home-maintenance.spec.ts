import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// "Home maintenance": a category and icons for small house repairs (owner's request: "change the
// batteries of the door lock"), with starter templates, and the kids' board filter (local stack only).
test.setTimeout(240_000);

test("home maintenance: category, battery icon, templates, and the kids' board filter", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`fix-${randomUUID().slice(0, 8)}@example.test`);
  await page.getByLabel("Password").fill(`fix-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  const home = `Fix family ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Home name").fill(home);
  await page.getByRole("button", { name: /add your kids/ }).click();
  await page.getByLabel("Kid 1 name").fill("Nora");
  await page.getByRole("button", { name: /pick chores/ }).click();
  // New accounts get the Home maintenance starters, pre-selected with the rest.
  await expect(page.getByRole("heading", { name: "Home maintenance" })).toBeVisible();
  await expect(page.getByText("Change the door lock batteries")).toBeVisible();
  await page.getByRole("button", { name: /the tablet/ }).click();
  const { data: hh } = await admin.from("households").select("id").eq("name", home).single();
  await expect
    .poll(async () => (await admin.from("chores").select("template_key, category").eq("household_id", hh!.id).eq("category", "home_maintenance")).data?.length)
    .toBe(5);

  // A chore from blank: the new category and the battery icon.
  await page.goto("/admin/chores");
  await page.getByRole("button", { name: "+ New chore" }).click();
  await page.getByRole("button", { name: /Start from blank/ }).click();
  const editor = page.getByRole("dialog", { name: "New chore" });
  await editor.getByLabel("Title").fill("Change the front door lock batteries");
  await editor.getByRole("button", { name: "🛠️ Home maintenance", exact: true }).click();
  await editor.getByRole("button", { name: "🔋", exact: true }).click();
  await editor.getByRole("button", { name: "Add chore", exact: true }).click();
  await expect(page.getByText("Change the front door lock batteries")).toBeVisible({ timeout: 60_000 });
  const { data: chore } = await admin.from("chores").select("category, emoji").eq("household_id", hh!.id).eq("title", "Change the front door lock batteries").single();
  expect(chore).toEqual({ category: "home_maintenance", emoji: "🔋" });

  // The ready-made templates are there too.
  await page.getByRole("button", { name: "+ New chore" }).click();
  await page.getByRole("dialog", { name: "New chore" }).getByRole("button", { name: /Start from a template/ }).click();
  const list = page.getByRole("dialog", { name: "Choose a template" });
  for (const t of ["Change the door lock batteries", "Test the smoke detectors", "Change the furnace filter"]) {
    await expect(list.getByRole("button", { name: new RegExp(t) })).toBeVisible();
  }
  await page.keyboard.press("Escape");

  // Kids' board: the category filter shows the new group.
  await page.goto("/admin/approvals");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Kids Mode/ }).first().click();
  await expect(page.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Nora/ }).click();
  await expect(page.getByRole("heading", { name: "Nora" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: /Home maintenance/ }).click();
  await expect(page.getByRole("button", { name: /Change the front door lock batteries/ })).toBeVisible();
  await ctx.close();
});
