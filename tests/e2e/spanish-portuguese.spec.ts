import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Per-kid Spanish and Portuguese boards in an English household (local stack only).
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const email = `espt-${randomUUID().slice(0, 8)}@example.test`;
const password = `espt-${randomUUID()}`;
const homeName = `EsPt family ${randomUUID().slice(0, 6)}`;
let kid: Page;
let parent: Page;
let householdId = "";
const kidId: Record<string, string> = {};

async function openBoard(name: string) {
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: new RegExp(name) }).click();
  await expect(kid.getByRole("heading", { name })).toBeVisible({ timeout: 40_000 });
}

async function setBoardLanguage(name: string, locale: string) {
  await parent.goto(`/admin/kids/${kidId[name]}`);
  await parent.getByLabel("Board language").selectOption(locale);
  await parent.getByRole("button", { name: "Save", exact: true }).click();
  await expect(parent.getByText("Saved")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await admin.from("kids").select("locale").eq("id", kidId[name]!).single()).data?.locale).toBe(locale);
}

test("setup: English home with Sofia, Joao and Liam; Sofia in Spanish, Joao in Portuguese", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill(homeName);
  await kid.getByLabel("Currency").selectOption("CAD");
  // All four languages are offered at onboarding.
  const language = kid.getByLabel("Language");
  await expect(language.locator("option")).toHaveText(["English", "Français", "Español", "Português"]);
  await language.selectOption("en");
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Sofia");
  await kid.getByRole("button", { name: "+ Add another" }).click();
  await kid.getByLabel("Kid 2 name").fill("Joao");
  await kid.getByRole("button", { name: "+ Add another" }).click();
  await kid.getByLabel("Kid 3 name").fill("Liam");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();

  const { data: hh } = await admin.from("households").select("id").eq("name", homeName).single();
  householdId = hh!.id;
  const { data: kids } = await admin.from("kids").select("id, name").eq("household_id", householdId);
  for (const k of kids ?? []) kidId[k.name] = k.id;

  // Starter chores carry all four languages.
  const { data: bed } = await admin.from("chores").select("translations").eq("household_id", householdId).eq("template_key", "make_bed").single();
  const tr = bed!.translations as Record<string, { title: string }>;
  expect(Object.keys(tr).sort()).toEqual(["en", "es", "fr", "pt"]);
  expect(tr.es!.title).toBe("Tiende tu cama");
  expect(tr.pt!.title).toBe("Arrume sua cama");

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  parent = await phone.newPage();
  await parent.goto("/login");
  await parent.getByLabel("Email").fill(email);
  await parent.getByLabel("Password").fill(password);
  await parent.getByRole("button", { name: "Log in" }).click();
  await expect(parent).toHaveURL(/\/admin/, { timeout: 45_000 });

  await parent.goto(`/admin/kids/${kidId.Sofia}`);
  await expect(parent.getByLabel("Board language").locator("option")).toHaveText([
    "Same as the household",
    "English",
    "Français",
    "Español",
    "Português",
  ]);
  await setBoardLanguage("Sofia", "es");
  await setBoardLanguage("Joao", "pt");
});

test("Sofia's board is in Spanish", async () => {
  await openBoard("Sofia");
  await expect(kid.getByText("en mi alcancía")).toBeVisible();
  await expect(kid.getByRole("button", { name: "Tiende tu cama", exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Tapetes del auto y aspiradora", exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Make your bed", exact: true })).toHaveCount(0);
  // Category pills and headings.
  await expect(kid.getByRole("button", { name: /Auto y garaje/ })).toBeVisible();
  await expect(kid.getByRole("button", { name: /Cocina/ })).toBeVisible();
  await expect(kid.getByRole("button", { name: /Todas/ }).first()).toBeVisible();
  await expect(kid.getByRole("button", { name: "Ordenar por precio" })).toBeVisible();
  await kid.getByRole("button", { name: /Auto y garaje/ }).click();
  await expect(kid.getByRole("button", { name: "Barrer el garaje", exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Tiende tu cama", exact: true })).toHaveCount(0);
  await kid.getByRole("button", { name: /Todas/ }).first().click();
  // Search in Spanish.
  await kid.getByRole("searchbox").fill("zzz");
  await expect(kid.getByText(/No encontramos nada/)).toBeVisible();
  await kid.getByRole("searchbox").fill("");
  await kid.screenshot({ path: "test-results/shots/kid-board-es.png" });

  // Submit a chore: the kid sees the Spanish flow.
  await kid.getByRole("button", { name: "Tiende tu cama", exact: true }).click();
  await kid.getByRole("button", { name: /¡Lo hice!/ }).click();
  await expect(kid.getByText("¡Enviado a Mamá/Papá para revisar!")).toBeVisible();
  await expect(kid.getByRole("heading", { name: /Esperando revisión/ })).toBeVisible();
});

test("Joao's board is in Portuguese", async () => {
  await openBoard("Joao");
  await expect(kid.getByText("no meu cofrinho")).toBeVisible();
  await expect(kid.getByRole("button", { name: "Arrume sua cama", exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Tapetes do carro e aspirador", exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Make your bed", exact: true })).toHaveCount(0);
  await expect(kid.getByRole("button", { name: /Carro e garagem/ })).toBeVisible();
  await expect(kid.getByRole("button", { name: /Cozinha/ })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Ordenar por preço" })).toBeVisible();
  await kid.getByRole("searchbox").fill("garagem");
  await kid.getByRole("button", { name: /Buscar/ }).click();
  await expect(kid.getByRole("button", { name: "Varrer a garagem", exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Arrume sua cama", exact: true })).toHaveCount(0);
  await kid.getByRole("searchbox").fill("");
  await kid.screenshot({ path: "test-results/shots/kid-board-pt.png" });
});

test("Liam (household language) stays in English", async () => {
  await openBoard("Liam");
  await expect(kid.getByText("in my bank")).toBeVisible();
  await expect(kid.getByRole("button", { name: "Make your bed", exact: true })).toBeVisible();
  await expect(kid.getByRole("button", { name: /Car & Garage/ })).toBeVisible();
});

test("household language can be set to Spanish or Portuguese", async () => {
  await parent.goto("/admin/settings");
  const language = parent.getByLabel("Language");
  await expect(language.locator("option")).toHaveText(["English", "Français", "Español", "Português"]);
  await language.selectOption("pt");
  await parent.getByRole("button", { name: "Save settings" }).click();
  await expect.poll(async () => (await admin.from("households").select("locale").eq("id", householdId).single()).data?.locale).toBe("pt");

  // The picker follows the household language; Liam now reads Portuguese.
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await expect(kid.getByRole("heading", { name: "Quem está aqui?" })).toBeVisible({ timeout: 40_000 });
  await kid.getByRole("button", { name: /Liam/ }).click();
  await expect(kid.getByRole("heading", { name: "Liam" })).toBeVisible({ timeout: 40_000 });
  await expect(kid.getByRole("button", { name: "Arrume sua cama", exact: true })).toBeVisible();
  await expect(kid.getByText("no meu cofrinho")).toBeVisible();

  // Sofia keeps her own Spanish board.
  await openBoard("Sofia");
  await expect(kid.getByText("en mi alcancía")).toBeVisible();
  await expect(kid.getByRole("button", { name: "Tapetes del auto y aspiradora", exact: true })).toBeVisible();
});
