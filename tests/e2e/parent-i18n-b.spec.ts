import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";
import * as B from "../../lib/i18n/parent/areaB";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Parent side, area B (chores + editor + templates, settings tabs, promotions, support) in the
// household's language, plus "New chore → Start from a template / Start from blank".
test.describe.configure({ mode: "serial" });
test.setTimeout(420_000);

const email = `i18n-b-${randomUUID().slice(0, 8)}@example.test`;
const password = `e2e-${randomUUID()}`;
const homeName = `I18nB family ${randomUUID().slice(0, 6)}`;
let kid: Page;
let parent: Page;
let householdId = "";

type Lang = "es" | "pt" | "fr";
const DICT = { es: B.es, pt: B.pt, fr: B.fr } as const;

/** English words that must not appear as a whole button / heading / link / text in a translated household. */
const ENGLISH = [
  "Save",
  "Edit",
  "Pause",
  "⏸ Pause",
  "Duplicate",
  "Delete",
  "Settings",
  "Cancel",
  "Remove",
  "Billing",
  "Add chore",
  "Save settings",
  "Send message",
  "Send invite",
  "Revoke",
  "Title",
  "Price",
  "Repeat",
];

async function expectNoEnglish(page: Page) {
  const main = page.locator("main");
  for (const word of ENGLISH) {
    await expect(main.getByRole("button", { name: word, exact: true }), `button "${word}"`).toHaveCount(0);
    await expect(main.getByRole("link", { name: word, exact: true }), `link "${word}"`).toHaveCount(0);
    await expect(main.getByRole("heading", { name: word, exact: true }), `heading "${word}"`).toHaveCount(0);
    await expect(main.getByText(word, { exact: true }), `text "${word}"`).toHaveCount(0);
  }
}

async function heading(page: Page, path: string, name: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name, { timeout: 30_000 });
}

test("setup: English home with Lucia (Spanish board), Morning routine left out", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill(homeName);
  await kid.getByLabel("Currency").selectOption("CAD");
  await kid.getByLabel("Language").selectOption("en");
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Lucia");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  const morning = kid.getByRole("button", { name: /^Morning routine/ });
  await morning.click();
  await expect(morning).toHaveAttribute("aria-pressed", "false");
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 40_000 });

  const { data: hh } = await admin.from("households").select("id").eq("name", homeName).single();
  householdId = hh!.id;
  await admin.from("kids").update({ locale: "es" }).eq("household_id", householdId);

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  parent = await phone.newPage();
  await parent.goto("/login");
  await parent.getByLabel("Email").fill(email);
  await parent.getByLabel("Password").fill(password);
  await parent.getByRole("button", { name: "Log in" }).click();
  await expect(parent).toHaveURL(/\/admin/, { timeout: 45_000 });
});

test("New chore → Start from a template: Morning routine, pre-filled, price tweaked, translations kept", async () => {
  await parent.goto("/admin/chores");
  await parent.getByRole("button", { name: "+ New chore" }).click();
  const chooser = parent.getByRole("dialog", { name: "New chore" });
  await expect(chooser.getByRole("button", { name: /Start from blank/ })).toBeVisible();
  await chooser.getByRole("button", { name: /Start from a template/ }).click();

  const list = parent.getByRole("dialog", { name: "Choose a template" });
  await expect(list.getByRole("heading", { name: "🔁 Routines" })).toBeVisible();
  await expect(list.getByRole("heading", { name: "🧹 Chores" })).toBeVisible();
  // Templates already on the board are marked but can still be picked.
  await expect(list.getByRole("button", { name: /Make your bed/ })).toContainText("✓ On your board");
  const pick = list.getByRole("button", { name: /Morning routine/ });
  await expect(pick).toContainText("🔁 Routine · 5 steps");
  await expect(pick).not.toContainText("On your board");
  await pick.click();

  const editor = parent.getByRole("dialog", { name: "New chore" });
  await expect(editor.getByLabel("Title")).toHaveValue("Morning routine");
  await expect(editor.getByRole("textbox", { name: /^Step \d+$/ })).toHaveCount(5);
  await expect(editor.getByText("🔁 This is a routine: it only pays when every step is done.")).toBeVisible();
  const price = editor.getByLabel("Price", { exact: true });
  await expect(price).toHaveValue("0.10");
  await price.fill("0.25");
  await editor.getByRole("button", { name: "Add chore", exact: true }).click();
  await expect(parent.getByText("🔁 Routine · 5 steps")).toBeVisible({ timeout: 30_000 });

  const { data: am } = await admin
    .from("chores")
    .select("title, price_cents, subtasks, translations")
    .eq("household_id", householdId)
    .eq("template_key", "morning_routine")
    .single();
  expect(am!.title).toBe("Morning routine");
  expect(am!.price_cents).toBe(25);
  expect((am!.subtasks as unknown[]).length).toBe(5);
  const tr = am!.translations as Record<string, { title: string; subtasks?: unknown[] }>;
  expect(tr.es!.title).toBe("Rutina de la mañana");
  expect(tr.fr!.title).toBe("Routine du matin");
  expect(tr.pt!.title).toBe("Rotina da manhã");
  expect(tr.es!.subtasks?.length).toBe(5);

  // Lucia's board is in Spanish: she sees the template's Spanish text.
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: /Lucia/ }).click();
  await expect(kid.getByRole("heading", { name: "Lucia" })).toBeVisible({ timeout: 40_000 });
  await expect(kid.getByRole("button", { name: /Rutina de la mañana/ })).toBeVisible({ timeout: 20_000 });
});

test("New chore → Start from blank still works; routines filter", async () => {
  await parent.goto("/admin/chores");
  await parent.getByRole("button", { name: "+ New chore" }).click();
  await parent.getByRole("button", { name: /Start from blank/ }).click();
  const editor = parent.getByRole("dialog", { name: "New chore" });
  await expect(editor.getByLabel("Title")).toHaveValue("");
  await editor.getByLabel("Title").fill("Water the plants");
  await editor.getByRole("button", { name: "Add chore", exact: true }).click();
  await expect(parent.getByText("Water the plants")).toBeVisible({ timeout: 60_000 });

  await parent.getByRole("button", { name: "routines", exact: true }).click();
  await expect(parent.getByText("Morning routine", { exact: true })).toBeVisible();
  await expect(parent.getByText("Water the plants")).toHaveCount(0);
});

for (const lang of ["es", "pt", "fr"] as const satisfies Lang[]) {
  test(`${lang}: chores, chore editor, every settings tab, promotions and support`, async () => {
    const d = DICT[lang];
    await admin.from("households").update({ locale: lang }).eq("id", householdId);

    // Chores board + chooser + editor (incl. subtasks section).
    await heading(parent, "/admin/chores", d["b.chores.title"]);
    await expect(parent.getByRole("button", { name: d["b.chores.newChore"] })).toBeVisible();
    await expect(parent.getByRole("button", { name: d["b.chores.edit"], exact: true }).first()).toBeVisible();
    await expect(parent.getByRole("button", { name: d["b.chores.duplicate"], exact: true }).first()).toBeVisible();
    await expect(parent.getByRole("button", { name: d["b.chores.filter.routines"], exact: true })).toBeVisible();
    await expect(parent.getByText(`🔁 ${d["b.routine.label"]} · ${d["b.chores.stepMany"].replace("{n}", "5")}`)).toBeVisible();
    await expectNoEnglish(parent);

    await parent.getByRole("button", { name: d["b.chores.newChore"] }).click();
    await parent.getByRole("button", { name: d["b.new.fromTemplate"] }).click();
    await expect(parent.getByRole("heading", { name: d["b.new.routines"] })).toBeVisible();
    await parent.getByRole("button", { name: d["b.new.back"] }).click();
    await parent.getByRole("button", { name: d["b.new.blank"] }).click();
    const editor = parent.getByRole("dialog", { name: d["b.chores.newChoreTitle"] });
    await expect(editor.getByLabel(d["b.editor.title"], { exact: true })).toBeVisible();
    await expect(editor.getByText(d["b.editor.subtasks"])).toBeVisible();
    await expect(editor.getByText(d["b.editor.subtasksHint"])).toBeVisible();
    await expect(editor.getByRole("button", { name: d["b.editor.addStep"] })).toBeVisible();
    await expect(editor.getByRole("button", { name: d["b.editor.addSection"] })).toBeVisible();
    await expect(editor.getByText(d["b.editor.repeat"], { exact: true })).toBeVisible();
    await expect(editor.getByRole("button", { name: d["b.editor.add"], exact: true })).toBeVisible();
    await editor.getByRole("button", { name: d["b.editor.addStep"] }).click();
    await editor.getByRole("textbox", { name: d["b.editor.stepN"].replace("{n}", "1") }).fill("✓");
    await expect(editor.getByText(d["b.editor.routineHeader"])).toBeVisible();
    // Client-side validation in the household language.
    await editor.getByLabel(d["b.editor.title"], { exact: true }).fill("X");
    await editor.getByLabel(d["b.editor.price"], { exact: true }).fill("abc");
    await editor.getByRole("button", { name: d["b.editor.add"], exact: true }).click();
    await expect(editor.getByText(d["b.editor.errPrice"])).toBeVisible();
    await expectNoEnglish(parent);
    await parent.keyboard.press("Escape");

    // Settings: General.
    await heading(parent, "/admin/settings", d["b.common.settings"]);
    await expect(parent.getByRole("link", { name: d["b.tabs.general"], exact: true })).toBeVisible();
    await expect(parent.getByRole("link", { name: d["b.tabs.tablets"], exact: true })).toBeVisible();
    await expect(parent.getByLabel(d["b.general.householdName"])).toHaveValue(homeName);
    await expect(parent.getByRole("button", { name: d["b.general.saveSettings"] })).toBeVisible();
    await expect(parent.getByText(d["b.me.weeklyLabel"])).toBeVisible();
    await expect(parent.getByRole("heading", { name: d["b.danger.title"] })).toBeVisible();
    await expectNoEnglish(parent);
    await parent.getByRole("button", { name: d["b.general.saveSettings"] }).click();
    await expect(parent.getByText(d["b.common.saved"], { exact: true })).toBeVisible({ timeout: 20_000 });

    // Promotions.
    await heading(parent, "/admin/settings/promotions", d["b.common.settings"]);
    await expect(parent.getByRole("link", { name: d["b.tabs.promotions"] })).toBeVisible();
    await expectNoEnglish(parent);

    // Tablets.
    await heading(parent, "/admin/settings/devices", d["b.common.settings"]);
    await expect(parent.getByRole("heading", { name: new RegExp(`^${d["b.devices.tablets"]}`) })).toBeVisible();
    await expect(parent.getByRole("heading", { name: d["b.devices.useTitle"] })).toBeVisible();
    await expect(parent.getByRole("button", { name: d["b.devices.revoke"] })).toBeVisible();
    await expectNoEnglish(parent);

    // Parents.
    await heading(parent, "/admin/settings/members", d["b.common.settings"]);
    await expect(parent.getByRole("heading", { name: d["b.members.inviteTitle"] })).toBeVisible();
    await expect(parent.getByRole("button", { name: d["b.members.send"] })).toBeVisible();
    await expect(parent.getByText(d["b.members.roleOwner"], { exact: true })).toBeVisible();
    await expectNoEnglish(parent);

    // Billing is hidden while First Payday is free: the page sends parents back to Settings.
    await parent.goto("/admin/settings/billing");
    await expect(parent).toHaveURL(/\/admin\/settings$/);

    // Help & feedback.
    await heading(parent, "/admin/support", d["b.support.title"]);
    await expect(parent.getByRole("button", { name: d["b.support.send"] })).toBeVisible();
    await expect(parent.getByRole("radio", { name: d["b.support.pick.bug"] })).toBeVisible();
    await expectNoEnglish(parent);
  });
}

test("back to English", async () => {
  await admin.from("households").update({ locale: "en" }).eq("id", householdId);
  await heading(parent, "/admin/settings", "Settings");
  await expect(parent.getByRole("button", { name: "Save settings" })).toBeVisible();
});
