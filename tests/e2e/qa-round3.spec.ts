import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// QA round 3 (FP_021–FP_024, KT_003/KT_004 again): the parts that live on the website (local stack only).
test.setTimeout(240_000);

const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function signUp(page: Page, opts: { email?: string; kids?: string[] } = {}) {
  const email = opts.email ?? `qa3-${randomUUID().slice(0, 8)}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(`qa3-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  const home = `QA3 family ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Home name").fill(home);
  await page.getByRole("button", { name: /add your kids/ }).click();
  const kids = opts.kids ?? ["Nora"];
  for (const [i, k] of kids.entries()) {
    if (i > 0) await page.getByRole("button", { name: "+ Add another" }).click();
    await page.getByLabel(`Kid ${i + 1} name`).fill(k);
  }
  await page.getByRole("button", { name: /pick chores/ }).click();
  await page.getByRole("button", { name: /the tablet/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/tablet/, { timeout: 30_000 });
  const { data: hh } = await admin.from("households").select("id").eq("name", home).single();
  return { email, householdId: hh!.id as string };
}

const box = async (l: Locator) => (await l.boundingBox())!;
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("phone: role pill clear of a long email, balances inside their boxes, max quantity + on screen", async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const longEmail = `vraj-joshi-long-${randomUUID().slice(0, 6)}@grewon-example.test`;
  const { householdId } = await signUp(page, { email: longEmail });
  await admin.from("households").update({ currency: "CLP" }).eq("id", householdId);

  // FP_021: the "owner" pill doesn't sit on top of the email.
  await page.goto("/admin/settings/members");
  const row = page.locator("li").filter({ has: page.getByTestId("member-name") }).first();
  const [name, pill] = await Promise.all([box(row.getByTestId("member-name")), box(row.getByText("owner", { exact: true }))]);
  expect(overlaps(name, pill)).toBe(false);

  // FP_022: "CLP 0.00" stays inside the Balance / Waiting for check boxes.
  const { data: kid } = await admin.from("kids").select("id").eq("household_id", householdId).single();
  await page.goto(`/admin/kids/${kid!.id}`);
  for (const m of await page.getByTestId("kid-money").all()) {
    const fits = await m.evaluate((el) => {
      const card = el.parentElement!.getBoundingClientRect();
      const r = document.createRange();
      r.selectNodeContents(el);
      const text = r.getBoundingClientRect();
      return text.right <= card.right - 8 && text.left >= card.left;
    });
    expect(fits).toBe(true);
  }

  // FP_024: the Max quantity "+" stays on screen.
  // A plain chore (routines have no max quantity).
  const { data: plain } = await admin.from("chores").select("title").eq("household_id", householdId).eq("subtasks", "[]").limit(1).single();
  await page.goto("/admin/chores");
  await page.locator("[draggable]").filter({ hasText: plain!.title }).first().getByRole("button", { name: "Edit", exact: true }).click();
  const plus = page.getByRole("dialog", { name: "Edit chore" }).getByRole("button", { name: "More max quantity" });
  await plus.scrollIntoViewIfNeeded();
  const p = await box(plus);
  expect(p.x + p.width).toBeLessThanOrEqual(390 - 16);
  await ctx.close();
});

test("in the app: a pull down doesn't reload while a sheet is open or the content is scrolled (FP_023)", async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  // Stand in for the Android app's bridge and record what the page tells it.
  await ctx.addInitScript(() => {
    (window as unknown as { pulls: boolean[] }).pulls = [];
    (window as unknown as { FirstPaydayAndroid: unknown }).FirstPaydayAndroid = {
      setPullBlocked: (b: boolean) => (window as unknown as { pulls: boolean[] }).pulls.push(b),
    };
  });
  const page = await ctx.newPage();
  await signUp(page);
  await page.goto("/admin/chores");
  const last = () => page.evaluate(() => (window as unknown as { pulls: boolean[] }).pulls.at(-1));

  const pageTitle = page.getByRole("heading", { name: "Chores", exact: true });
  await pageTitle.tap();
  expect(await last()).toBe(false);
  await page.getByRole("button", { name: "+ New chore" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("heading").first().tap();
  expect(await last()).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await pageTitle.tap();
  expect(await last()).toBe(false);
  await ctx.close();
});

test("kids' tablet at 600px: the name shows, nothing runs off the right edge (KT_003/KT_004)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 600, height: 960 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const { householdId } = await signUp(page, { kids: ["Daniela"] });
  await admin.from("households").update({ currency: "CLP" }).eq("id", householdId);
  await page.goto("/admin/approvals");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Kids Mode/ }).first().click();
  await expect(page.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Daniela/ }).click();
  const heading = page.getByRole("heading", { name: "Daniela" });
  await expect(heading).toBeVisible({ timeout: 40_000 });
  // The whole name is readable (not squeezed to nothing).
  const fullWidth = await heading.evaluate((el) => el.scrollWidth <= el.clientWidth && el.clientWidth > 60);
  expect(fullWidth).toBe(true);
  const money = await box(page.getByRole("button", { name: "My money" }));
  expect(money.x + money.width).toBeLessThanOrEqual(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await ctx.close();
});
