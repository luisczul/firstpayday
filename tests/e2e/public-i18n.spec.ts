import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// The public site in English (/), French (/fr), Spanish (/es) and Portuguese (/pt).
// Run against a dev server: E2E_PORT=3000 pnpm exec playwright test tests/e2e/public-i18n.spec.ts

const LANGS = [
  { lang: "en", prefix: "", home: /pays your kids/i, guide: /chore chart app/i, terms: "Terms of Service", footer: "Chore chart app" },
  { lang: "fr", prefix: "/fr", home: /paie vos enfants/i, guide: /tableau de tâches/i, terms: "Conditions d'utilisation", footer: "Tableau de tâches" },
  { lang: "es", prefix: "/es", home: /les paga a tus hijos/i, guide: /tabla de tareas/i, terms: "Términos del servicio", footer: "App de tabla de tareas" },
  { lang: "pt", prefix: "/pt", home: /paga seus filhos/i, guide: /quadro de tarefas/i, terms: "Termos de Serviço", footer: "App de quadro de tarefas" },
] as const;

const NAMES = { en: "English", fr: "Français", es: "Español", pt: "Português" } as const;

// Owner's copy rules: nothing "forever" in any language, and no adult-sized prices while the product is free.
const FORBIDDEN = /forever|toujours|siempre|sempre|\$5/i;

/** Everything a reader or a search engine sees: visible text, title, meta description and JSON-LD. */
async function readableText(page: Page): Promise<string> {
  return page.evaluate(() => {
    // All text nodes, including collapsed <details> answers, minus scripts (framework payloads).
    const body = document.body.cloneNode(true) as HTMLElement;
    body.querySelectorAll("script, style, template").forEach((el) => el.remove());
    return [
      document.title,
      document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      body.textContent ?? "",
      ...Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? ""),
    ].join("\n");
  });
}

async function checkPage(page: Page, lang: string, path: string, englishPath: string) {
  await expect(page.locator("html")).toHaveAttribute("lang", lang);

  // hreflang alternates for all four languages + x-default, and a self canonical.
  for (const [l, pre] of [["en", ""], ["fr", "/fr"], ["es", "/es"], ["pt", "/pt"], ["x-default", ""]] as const) {
    const href = await page.locator(`head link[rel="alternate"][hreflang="${l}"]`).getAttribute("href");
    expect(new URL(href!).pathname).toBe(englishPath === "/" ? pre || "/" : `${pre}${englishPath}`);
  }
  const canonical = await page.locator('head link[rel="canonical"]').getAttribute("href");
  expect(new URL(canonical!).pathname).toBe(path);

  // Footer links to the same page in all four languages.
  const footer = page.getByRole("contentinfo");
  for (const [l, name] of Object.entries(NAMES)) {
    const pre = l === "en" ? "" : `/${l}`;
    const expected = englishPath === "/" ? pre || "/" : `${pre}${englishPath}`;
    await expect(footer.getByRole("link", { name, exact: true })).toHaveAttribute("href", expected);
  }
  await expect(footer.getByRole("link", { name: "info@firstpayday.app" })).toBeVisible();

  const text = await readableText(page);
  expect(text.match(FORBIDDEN), `${path} must not contain ${text.match(FORBIDDEN)?.[0]}`).toBeNull();
}

for (const L of LANGS) {
  test(`public site in ${L.lang}: home, guide, terms, privacy`, async ({ page }) => {
    const home = L.prefix || "/";
    await page.goto(home);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(L.home);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: L.footer, exact: true })).toBeVisible();
    // FAQ JSON-LD is in the page language.
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld!)["@graph"].find((n: { "@type": string }) => n["@type"] === "FAQPage").inLanguage).toBe(L.lang);
    await checkPage(page, L.lang, home, "/");

    await page.goto(`${L.prefix}/chore-chart-app`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(L.guide);
    await checkPage(page, L.lang, `${L.prefix}/chore-chart-app`, "/chore-chart-app");

    await page.goto(`${L.prefix}/paid-chores-list`);
    await checkPage(page, L.lang, `${L.prefix}/paid-chores-list`, "/paid-chores-list");

    await page.goto(`${L.prefix}/terms`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(L.terms);
    if (L.lang !== "en") await expect(page.getByText(/(anglaise|inglés|inglês)/)).toBeVisible();
    await checkPage(page, L.lang, `${L.prefix}/terms`, "/terms");

    await page.goto(`${L.prefix}/privacy`);
    await checkPage(page, L.lang, `${L.prefix}/privacy`, "/privacy");
  });
}

test("header switcher and footer move between languages on the same page", async ({ page }) => {
  await page.goto("/allowance-app-for-kids");
  await page.getByRole("banner").getByLabel("Language").click();
  await page.getByRole("banner").getByRole("link", { name: "Español" }).click();
  await expect(page).toHaveURL(/\/es\/allowance-app-for-kids$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.getByRole("contentinfo").getByRole("link", { name: "Português" }).click();
  await expect(page).toHaveURL(/\/pt\/allowance-app-for-kids$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/mesada/i);
  // Localized pages link to the localized signup.
  await expect(page.getByRole("banner").getByRole("link", { name: "Comece grátis" })).toHaveAttribute("href", "/signup?lang=pt");
});

test("unknown prefixed pages 404 and app routes are untouched", async ({ page }) => {
  expect((await page.goto("/fr/admin"))!.status()).toBe(404);
  expect((await page.goto("/fr/nope"))!.status()).toBe(404);
  const login = await page.goto("/login");
  expect(login!.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("sitemap lists every language version", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/", "/terms", "/privacy", "/chore-chart-app", "/allowance-app-for-kids", "/paid-chores-list"]) {
    for (const pre of ["/fr", "/es", "/pt"]) expect(xml).toContain(`${pre}${path === "/" ? "" : path}</loc>`);
  }
  expect(xml).toContain('hreflang="x-default"');
});

test("the English home suggests (never forces) the browser language", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "fr-CA" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/); // no redirect
  await expect(page.getByRole("link", { name: "Oui" })).toHaveAttribute("href", "/fr");
  await page.getByRole("button", { name: "Non merci" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/pays your kids/i);
  await expect(page.getByRole("button", { name: "Non merci" })).toHaveCount(0);
  await ctx.close();
});

test("signing up from /fr defaults the new household to French (local stack)", async ({ browser }) => {
  // An English browser, so only the signup language can make the default French.
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto("/fr/signup");
  await expect(page).toHaveURL(/\/signup\?lang=fr$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { name: "Créez votre compte gratuit" })).toBeVisible();
  await expect(page.getByText("Pourquoi c'est important pour vos enfants")).toBeVisible();
  await page.getByLabel("Courriel").fill(`i18n-${randomUUID().slice(0, 8)}@example.test`);
  await page.getByLabel("Mot de passe").fill(`i18n-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByLabel("Nom du foyer")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Langue")).toHaveValue("fr");
  await ctx.close();
});
