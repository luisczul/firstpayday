import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// "Recently added" and "Recently done": on the kids' board and on the parent's Chores page (local stack only).
test.setTimeout(240_000);

/** Reading order (rows top to bottom, then left to right) of the given elements' titles. */
async function readingOrder(boxes: Promise<{ x: number; y: number } | null>[], titles: string[]) {
  const b = await Promise.all(boxes);
  return titles
    .map((t, i) => ({ t, x: b[i]!.x, y: Math.round(b[i]!.y / 20) }))
    .sort((p, q) => p.y - q.y || p.x - q.x)
    .map((p) => p.t);
}

/** Titles of the chore cards on the kids' board, in reading order. */
const boardTitles = (page: Page, titles: string[]) =>
  readingOrder(titles.map((t) => page.getByRole("button", { name: new RegExp(t) }).first().boundingBox()), titles);

test("kids' board and Chores page sort by recently added and recently done", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`sort-${randomUUID().slice(0, 8)}@example.test`);
  await page.getByLabel("Password").fill(`sort-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  const home = `Sort family ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Home name").fill(home);
  await page.getByRole("button", { name: /add your kids/ }).click();
  await page.getByLabel("Kid 1 name").fill("Nora");
  await page.getByRole("button", { name: /pick chores/ }).click();
  await page.getByRole("button", { name: /the tablet/ }).click();
  const { data: hh } = await admin.from("households").select("id").eq("name", home).single();
  const { data: kid } = await admin.from("kids").select("id").eq("household_id", hh!.id).single();

  // Exactly three chores: parent order Old → Middle → Newest; created oldest → newest.
  await expect.poll(async () => (await admin.from("chores").select("id").eq("household_id", hh!.id)).data?.length).toBeGreaterThan(0);
  await admin.from("chores").update({ active: false }).eq("household_id", hh!.id);
  const base = { household_id: hh!.id, price_cents: 100, repeat_kind: "daily", scope: "per_kid", requires_approval: true, category: "other" };
  const { data: made } = await admin
    .from("chores")
    .insert([
      { ...base, title: "Old chore", sort_order: 1, created_at: "2026-01-01T00:00:00Z" },
      { ...base, title: "Middle chore", sort_order: 2, created_at: "2026-05-01T00:00:00Z" },
      { ...base, title: "Newest chore", sort_order: 3, created_at: new Date().toISOString() },
    ])
    .select("id, title");
  const oldId = made!.find((c) => c.title === "Old chore")!.id;
  // Nora did "Old chore" a while ago (approved): it comes back daily, so it's on the board again.
  await admin.from("submissions").insert({
    household_id: hh!.id,
    chore_id: oldId,
    kid_id: kid!.id,
    quantity: 1,
    unit_price_cents: 100,
    amount_cents: 100,
    chore_title_snapshot: "Old chore",
    status: "approved",
    submitted_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    reviewed_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  });

  // Parent's Chores page.
  await page.goto("/admin/chores");
  const titles = ["Old chore", "Middle chore", "Newest chore"];
  const order = () => readingOrder(titles.map((t) => page.getByText(t, { exact: true }).boundingBox()), titles);
  await expect.poll(order).toEqual(["Old chore", "Middle chore", "Newest chore"]);
  await expect(page.getByRole("button", { name: "Move earlier" }).first()).toBeVisible();
  await page.getByLabel("Sort").selectOption("added");
  await expect.poll(order).toEqual(["Newest chore", "Middle chore", "Old chore"]);
  // No reordering while sorted.
  await expect(page.getByRole("button", { name: "Move earlier" })).toHaveCount(0);
  await page.getByLabel("Sort").selectOption("done");
  await expect.poll(order).toEqual(["Old chore", "Middle chore", "Newest chore"]);

  // Kids' board. Sorting applies inside each row, like the price sort: "Newest chore" (just added)
  // and "Old chore" (daily, back this morning) are both in the "New!" row.
  await page.goto("/admin/approvals");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Kids Mode/ }).first().click();
  await expect(page.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Nora/ }).click();
  await expect(page.getByRole("heading", { name: "Nora" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: /Recently added/ }).click();
  await expect(page.getByRole("button", { name: /Recently added/ })).toHaveAttribute("aria-pressed", "true");
  const newRow = ["Old chore", "Newest chore"];
  await expect.poll(() => boardTitles(page, newRow)).toEqual(["Newest chore", "Old chore"]);
  await page.getByRole("button", { name: /Recently done/ }).click();
  await expect(page.getByRole("button", { name: /Recently added/ })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => boardTitles(page, newRow)).toEqual(["Old chore", "Newest chore"]);
  // Tapping it again goes back to the parent's order.
  await page.getByRole("button", { name: /Recently done/ }).click();
  await expect(page.getByRole("button", { name: /Recently done/ })).toHaveAttribute("aria-pressed", "false");
  await ctx.close();
});
