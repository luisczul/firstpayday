import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// A parent adds to a kid's balance for something that isn't a chore: icon, name, what it was.
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const email = `reward-${randomUUID().slice(0, 8)}@example.test`;
const password = `reward-${randomUUID()}`;
let kid: Page;
let parent: Page;
let noraId = "";

const balance = async () => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", noraId).single()).data?.balance_cents;

async function openMoney() {
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: /Nora/ }).click();
  await expect(kid.getByRole("heading", { name: "Nora" })).toBeVisible({ timeout: 40_000 });
  await kid.getByRole("button", { name: /My money|Mon argent/ }).click();
}

test("setup", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill("Reward family");
  await kid.getByLabel("Currency").selectOption("CAD");
  await kid.getByLabel("Language").selectOption("en");
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Nora");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });

  const { data: hh } = await admin.from("households").select("id").eq("name", "Reward family").order("created_at", { ascending: false }).limit(1).single();
  const { data: k } = await admin.from("kids").select("id").eq("household_id", hh!.id).eq("name", "Nora").single();
  noraId = k!.id;

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  parent = await phone.newPage();
  await parent.goto("/login");
  await parent.getByLabel("Email").fill(email);
  await parent.getByLabel("Password").fill(password);
  await parent.getByRole("button", { name: "Log in" }).click();
  await expect(parent).toHaveURL(/\/admin/, { timeout: 45_000 });
});

test("parent adds $1 with an icon, a name and what it was; the kid sees it", async () => {
  await parent.goto(`/admin/kids/${noraId}`);
  const form = parent.getByTestId("reward-form");
  await expect(form.getByRole("heading", { name: "⭐ Add to balance" })).toBeVisible({ timeout: 30_000 });

  // A name is required.
  await form.getByLabel("Amount").fill("1");
  await form.getByRole("button", { name: /Add to balance/ }).click();
  await expect(form.getByText("Give it a name so everyone knows why.")).toBeVisible();

  await form.getByRole("button", { name: "🛒" }).click();
  await form.getByLabel("Name").fill("Helped me with the groceries");
  await form.getByLabel("What it was (optional)").fill("Because you helped me carry the bags");
  await form.getByRole("button", { name: "🛒 Add to balance" }).click();
  await expect(form.getByText("Added to the balance ✅")).toBeVisible();
  await expect(form.getByLabel("Name")).toHaveValue("");
  expect(await balance()).toBe(100);

  // Parent's money history shows the icon and name, and what it was.
  await expect(parent.getByText("🛒 Helped me with the groceries")).toBeVisible();
  await expect(parent.getByText(/Because you helped me carry the bags/)).toBeVisible();

  // A custom emoji, and a correction on the minus side.
  await form.getByLabel("Other").fill("🦸");
  await form.getByLabel("Name").fill("Superhero help");
  await form.getByLabel("Amount").fill("0.50");
  await form.getByRole("button", { name: "🦸 Add to balance" }).click();
  await expect(form.getByLabel("Name")).toHaveValue("");
  await expect(form.getByText("Added to the balance ✅")).toBeVisible();
  await form.getByRole("button", { name: "Take away" }).click();
  await form.getByLabel("Name").fill("Oops, counted twice");
  await form.getByLabel("Amount").fill("0.25");
  await form.getByRole("button", { name: /Take from balance/ }).click();
  await expect(form.getByText("Taken from the balance")).toBeVisible();
  expect(await balance()).toBe(125);

  const { data: rows } = await admin.from("ledger_entries").select("icon, title, note, amount_cents").eq("kid_id", noraId).order("created_at");
  expect(rows).toEqual([
    { icon: "🛒", title: "Helped me with the groceries", note: "Because you helped me carry the bags", amount_cents: 100 },
    { icon: "🦸", title: "Superhero help", note: null, amount_cents: 50 },
    { icon: "⭐", title: "Oops, counted twice", note: null, amount_cents: -25 },
  ]);

  // History (screen) names it with its icon.
  await parent.goto("/admin/history");
  await expect(parent.getByText("🛒 Helped me with the groceries").first()).toBeVisible({ timeout: 30_000 });

  // The kid's money list: icon, name and what it was.
  await openMoney();
  const dialog = kid.getByRole("dialog");
  await expect(dialog.getByText("Helped me with the groceries")).toBeVisible();
  await expect(dialog.getByText("Because you helped me carry the bags")).toBeVisible();
  await expect(dialog.getByText("🛒")).toBeVisible();
  await expect(dialog.getByText("Superhero help")).toBeVisible();
  await expect(dialog.getByText("+$1.00")).toBeVisible();
});

test("a kid reading French sees the reward in French once translated", async () => {
  await admin.from("kids").update({ locale: "fr" }).eq("id", noraId);
  const { data: row } = await admin.from("ledger_entries").select("id").eq("kid_id", noraId).eq("title", "Helped me with the groceries").single();
  // What the background translation stores (Claude isn't reachable from the test machine).
  const fr = { title: "M'a aidé avec l'épicerie", description: "Parce que tu m'as aidé à porter les sacs", unit_label: null, note_for_kids: null };
  const { error } = await admin.from("ledger_entries").update({ translations: { fr } }).eq("id", row!.id);
  expect(error).toBeNull();

  await openMoney();
  const dialog = kid.getByRole("dialog");
  await expect(dialog.getByText("M'a aidé avec l'épicerie")).toBeVisible();
  await expect(dialog.getByText("Parce que tu m'as aidé à porter les sacs")).toBeVisible();
  // Not translated yet: the parent's words.
  await expect(dialog.getByText("Superhero help")).toBeVisible();
});
