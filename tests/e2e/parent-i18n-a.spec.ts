import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Parent side, area A (onboarding, approvals, kids, payouts, history) in the household's language.
// Signs up from /signup?lang=xx with an English browser, so only the signup language can switch it.

test.describe.configure({ mode: "serial" });

const SIGNUP = {
  es: { email: "Correo electrónico", password: "Contraseña", create: "Crear mi cuenta" },
  pt: { email: "E-mail", password: "Senha", create: "Criar minha conta" },
  fr: { email: "Courriel", password: "Mot de passe", create: "Créer mon compte" },
} as const;

const L = {
  es: {
    home: /Ponle nombre a tu hogar/,
    homeName: "Nombre del hogar",
    language: "Idioma",
    homeNext: /agrega a tus hijos/,
    kids: /Agrega a tus hijos/,
    kidName: "Nombre del niño 1",
    kidsNext: /elige las tareas/,
    chores: /Elige tus tareas/,
    choresNext: /la tableta/,
    tablet: /¿Configurar esta tableta\?/,
    later: "Lo haré más tarde",
    approvals: "Aprobaciones",
    kidsTitle: "Niños",
    payouts: "Pagos",
    history: "Historial",
  },
  pt: {
    home: /Dê um nome à sua casa/,
    homeName: "Nome da casa",
    language: "Idioma",
    homeNext: /adicione seus filhos/,
    kids: /Adicione seus filhos/,
    kidName: "Nome da criança 1",
    kidsNext: /escolha as tarefas/,
    chores: /Escolha suas tarefas/,
    choresNext: /o tablet/,
    tablet: /Configurar este tablet\?/,
    later: "Vou fazer depois",
    approvals: "Aprovações",
    kidsTitle: "Crianças",
    payouts: "Pagamentos",
    history: "Histórico",
  },
  fr: {
    home: /Nommez votre foyer/,
    homeName: "Nom du foyer",
    language: "Langue",
    homeNext: /ajoutez vos enfants/,
    kids: /Ajoutez vos enfants/,
    kidName: "Prénom de l'enfant 1",
    kidsNext: /choisissez les tâches/,
    chores: /Choisissez vos tâches/,
    choresNext: /la tablette/,
    tablet: /Configurer cette tablette\?/,
    later: "Je le ferai plus tard",
    approvals: "Approbations",
    kidsTitle: "Enfants",
    payouts: "Paiements",
    history: "Historique",
  },
} as const;

type Lang = keyof typeof L;

/** Sign up in `lang` and walk through the four onboarding steps, checking each step's text. */
async function signUpAndOnboard(browser: Browser, lang: Lang): Promise<Page> {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  const s = SIGNUP[lang];
  const l = L[lang];
  await page.goto(`/signup?lang=${lang}`);
  await page.getByLabel(s.email).fill(`i18n-a-${lang}-${randomUUID().slice(0, 8)}@example.test`);
  await page.getByLabel(s.password).fill(`e2e-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: s.create }).click();

  await expect(page.getByRole("heading", { name: l.home })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel(l.language)).toHaveValue(lang);
  await page.getByLabel(l.homeName).fill(`Familia ${lang}`);
  await page.getByRole("button", { name: l.homeNext }).click();

  await expect(page.getByRole("heading", { name: l.kids })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(l.kidName).fill("Lucía");
  await page.getByRole("button", { name: l.kidsNext }).click();

  await expect(page.getByRole("heading", { name: l.chores })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: l.choresNext }).click();

  await expect(page.getByRole("heading", { name: l.tablet })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: l.later }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
  return page;
}

async function expectHeading(page: Page, path: string, name: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

/** English words that must not appear as a whole button / heading / label in a Spanish household. */
const ENGLISH = [
  "Approvals",
  "Approve",
  "Kids",
  "Kid",
  "Payouts",
  "Payout",
  "Record payout",
  "Payout history",
  "History",
  "Save",
  "Saved",
  "Cancel",
  "Filter",
  "Clear",
  "+ Add kid",
  "Add kid",
  "All caught up!",
  "This month",
  "This year",
  "Amount",
  "Balance",
  "Recent chores",
  "Money history",
  "Board language",
  "Archive",
  "Date",
  "What",
  "Tablet",
];

async function expectNoEnglish(page: Page) {
  const main = page.locator("main");
  for (const word of ENGLISH) {
    await expect(main.getByRole("button", { name: word, exact: true }), `button "${word}"`).toHaveCount(0);
    await expect(main.getByRole("heading", { name: word, exact: true }), `heading "${word}"`).toHaveCount(0);
    await expect(main.getByText(word, { exact: true }), `text "${word}"`).toHaveCount(0);
  }
}

test("Spanish: onboarding and the parent pages are in Spanish", async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await signUpAndOnboard(browser, "es");

  await expectHeading(page, "/admin/approvals", "Aprobaciones");
  await expect(page.getByText("¡Todo al día!")).toBeVisible();
  await expectNoEnglish(page);

  await expectHeading(page, "/admin/kids", "Niños");
  await expect(page.getByRole("button", { name: "+ Agregar niño" })).toBeVisible();
  await expectNoEnglish(page);

  // Kid page: editor, balances, check-ins, avatar picker.
  await page.goto((await page.getByRole("link", { name: /Lucía/ }).getAttribute("href"))!);
  await expect(page.getByLabel("Idioma del tablero")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeVisible();
  await expect(page.getByText("Historial de dinero")).toBeVisible();
  await expect(page.getByText("Visitas a la tableta")).toBeVisible();
  await expectNoEnglish(page);
  await page.getByRole("button", { name: "Elegir una imagen" }).click();
  await expect(page.getByRole("dialog", { name: "Elegir una imagen" })).toContainText("Elige un compañero");
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

  // Adjustment → an error and a success message in Spanish.
  await page.getByPlaceholder("Me ayudó con las compras").fill("Regalo");
  await page.getByRole("button", { name: /Sumar al saldo/ }).click();
  await expect(page.getByText("Escribe un monto.")).toBeVisible();

  await expectHeading(page, "/admin/payouts", "Pagos");
  await expect(page.getByRole("button", { name: "Registrar pago" })).toBeVisible();
  await expect(page.getByText("Historial de pagos")).toBeVisible();
  await expectNoEnglish(page);
  // Server action error in the household language.
  await page.getByLabel("Monto").fill("5");
  await page.getByRole("button", { name: "Registrar pago" }).click();
  await expect(page.getByText(/Es más que el saldo/)).toBeVisible();

  await expectHeading(page, "/admin/history", "Historial");
  await expect(page.getByRole("button", { name: "Filtrar" })).toBeVisible();
  await expect(page.getByLabel("Tipo")).toContainText("Todo");
  await expectNoEnglish(page);
  await page.context().close();
});

for (const lang of ["pt", "fr"] as const) {
  test(`${lang}: onboarding and parent page headings`, async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await signUpAndOnboard(browser, lang);
    const l = L[lang];
    await expectHeading(page, "/admin/approvals", l.approvals);
    await expectHeading(page, "/admin/kids", l.kidsTitle);
    await expectHeading(page, "/admin/payouts", l.payouts);
    await expectHeading(page, "/admin/history", l.history);
    await page.context().close();
  });
}
