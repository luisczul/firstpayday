import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/templates";
import { pickCurrency } from "./pickCurrency";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Kid board: category buttons wrap (no sideways scroll) and ready chores fill one grid with a
// colored category tag on each card, instead of a half-empty section per category (local stack).
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const email = `grid-${randomUUID().slice(0, 8)}@example.test`;
const password = `grid-${randomUUID()}`;
let kid: Page;

test("setup: a home with one chore in every category", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill("Grid family");
  await pickCurrency(kid, "CAD");
  await kid.getByLabel("Language").selectOption("en");
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Liam");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();

  const { data: hh } = await admin.from("households").select("id").eq("name", "Grid family").order("created_at", { ascending: false }).limit(1).single();
  await admin.from("chores").delete().eq("household_id", hh!.id);
  const { error } = await admin.from("chores").insert(
    CATEGORIES.map((category, i) => ({
      household_id: hh!.id,
      title: `${CATEGORY_LABELS[category]!.en} job`,
      price_cents: 100 + i * 50,
      repeat_kind: "weekly" as const,
      scope: "household" as const,
      category,
      sort_order: i,
      created_at: "2026-01-01T00:00:00Z",
    })),
  );
  expect(error).toBeNull();
  // A routine (chore with steps) goes in the same grid.
  const { error: rErr } = await admin.from("chores").insert({
    household_id: hh!.id, title: "Morning routine job", price_cents: 100, repeat_kind: "daily", scope: "per_kid",
    category: "other", sort_order: 99, created_at: "2026-01-01T00:00:00Z",
    subtasks: [{ id: "a", title: "Brush teeth" }, { id: "b", title: "Make bed" }],
  });
  expect(rErr).toBeNull();
});

for (const [name, viewport] of [["tablet", { width: 1180, height: 820 }], ["phone", { width: 390, height: 844 }]] as const) {
  test(`${name}: category buttons wrap, one full grid with a tag on every card`, async () => {
    await kid.setViewportSize(viewport);
    await kid.goto("/kids");
    await kid.waitForLoadState("networkidle");
    await kid.getByRole("button", { name: /Liam/ }).click();
    await expect(kid.getByRole("heading", { name: "Liam" })).toBeVisible({ timeout: 40_000 });

    const nav = kid.getByRole("navigation", { name: "Categories" });
    await expect(nav.getByRole("button", { name: /All/ })).toBeVisible();
    // Nothing hidden sideways: the menu and the page fit the screen.
    expect(await nav.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
    expect(await kid.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    // Every category button is on screen (wrapped onto more rows).
    for (const c of CATEGORIES) {
      const b = nav.getByRole("button", { name: `${CATEGORY_LABELS[c]!.emoji} ${CATEGORY_LABELS[c]!.en}`, exact: true });
      const box = (await b.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }

    // One "Ready to do" section, no heading per category; each card shows its category.
    await expect(kid.getByRole("heading", { name: /^Ready to do/ })).toHaveCount(1);
    for (const c of CATEGORIES) await expect(kid.getByRole("heading", { name: new RegExp(`^${CATEGORY_LABELS[c]!.en}`) })).toHaveCount(0);
    const tags = kid.getByTestId("card-category");
    await expect(tags).toHaveCount(CATEGORIES.length + 1);
    await expect(kid.getByRole("heading", { name: /My routines|New!/ })).toHaveCount(0);
    await expect(kid.getByRole("button", { name: "Outdoor job", exact: true }).getByTestId("card-category")).toHaveText("🌳 Outdoor");
    // The grid is full: on the tablet, several cards share the first row.
    if (name === "tablet") {
      const tops = await kid.getByRole("button", { name: / job$/ }).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(tops.filter((t) => t === tops[0]).length).toBe(6);
    } else {
      const tops = await kid.getByRole("button", { name: / job$/ }).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(tops.filter((t) => t === tops[0]).length).toBe(2);
    }
    // Every card in the one grid: 8 chores + the routine, all under "Ready to do".
    const todo = kid.locator("section", { has: kid.getByRole("heading", { name: /^Ready to do/ }) });
    await expect(todo.getByRole("button", { name: / job$/ })).toHaveCount(CATEGORIES.length + 1);
    await kid.evaluate(() => window.scrollTo(0, 0));
    await kid.waitForTimeout(300);
    await kid.screenshot({ path: `test-results/shots/kid-grid-${name}.png` });

    // Picking a category still filters, and the section is named after it.
    await nav.getByRole("button", { name: "🍳 Kitchen", exact: true }).click();
    await expect(kid.getByRole("button", { name: / job$/ })).toHaveCount(1);
    await expect(kid.getByRole("heading", { name: /^🍳 Kitchen/ })).toBeVisible();
  });
}
