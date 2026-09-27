import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "../../scripts/load-env";
import { t as kidT, type Locale } from "@/lib/i18n";
import { parentDicts, parentT } from "@/lib/i18n/parent";
import { taxPromoCopy } from "@/lib/i18n/taxPromoCopy";
import { marketing } from "@/lib/i18n/marketing";
import { CATEGORY_LABELS, NAMED_INTERVALS } from "@/lib/templates";
import { formatMoney } from "@/lib/money/format";
import { PRESET_NAMES } from "@/lib/avatarPresets";
import kidEn from "@/lib/i18n/en.json";
import kidFr from "@/lib/i18n/fr.json";
import kidEs from "@/lib/i18n/es.json";
import kidPt from "@/lib/i18n/pt.json";

/**
 * One complete "from zero" run of the product in a language: public home, signup,
 * onboarding (tax on, a fox buddy and a cropped photo, templates incl. routines),
 * the kids' tablet, the review email's one-tap login, approvals with a tip, undo as a
 * revision, a +20% promotion, a taxed payout, help & feedback and the weekly report.
 *
 * Every screen is audited for English leftovers (exact matches against the English
 * dictionaries and a list of common UI words), mojibake, "forever"-type words, prices
 * and horizontal overflow, and saved as a full-page screenshot in
 * /tmp/claude-501/journeys/{lang}/NN-name.png (phone 390px and tablet 1180px).
 *
 * Local stack only (Mailpit, service role). Used by tests/e2e/journey-{en,fr,es,pt}.spec.ts.
 */

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const MAILPIT = "http://127.0.0.1:54324";
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 1180, height: 820 };

type Cfg = {
  currency: string;
  kids: [string, string];
  home: string;
  /** Accent-free search for a template title that has accents in this language. */
  search: { q: string; key: string };
  note: string;
  promo: string;
  support: string;
  /** Home page h1 must contain this. */
  hero: RegExp;
};

const CFG: Record<Locale, Cfg> = {
  en: {
    currency: "CAD",
    kids: ["Liam", "Emma"],
    home: "Walker family",
    search: { q: "laundry", key: "laundry" },
    note: "The recycling bin is still inside",
    promo: "Saturday blitz",
    support: "Love the routines! Could the tablet show a clock too?",
    hero: /pays your kids/i,
  },
  fr: {
    currency: "CAD",
    kids: ["Félix", "Léa"],
    home: "Famille Tremblay",
    search: { q: "menage", key: "bathroom_deep" },
    note: "Le bac de recyclage est encore à l'intérieur",
    promo: "Blitz du samedi",
    support: "J'adore les routines! La tablette pourrait-elle afficher l'heure?",
    hero: /paie vos enfants/i,
  },
  es: {
    currency: "MXN",
    kids: ["Mateo", "Sofía"],
    home: "Familia García",
    search: { q: "rutina del dia", key: "daily_routine" },
    note: "El bote de reciclaje sigue adentro",
    promo: "Sábado relámpago",
    support: "¡Me encantan las rutinas! ¿La tableta podría mostrar la hora?",
    hero: /les paga a tus hijos/i,
  },
  pt: {
    currency: "BRL",
    kids: ["João", "Ana"],
    home: "Família Souza",
    search: { q: "manha", key: "morning_routine" },
    note: "A lixeira de reciclagem ainda está dentro de casa",
    promo: "Sábado turbo",
    support: "Adorei as rotinas! O tablet poderia mostrar as horas?",
    hero: /paga seus filhos/i,
  },
};

const KID_DICTS: Record<Locale, Record<string, string>> = { en: kidEn, fr: kidFr, es: kidEs, pt: kidPt };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Strip emoji / punctuation at the ends: "🔁 My routines" → "My routines". */
const norm = (s: string) => s.replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();

/** Common English UI words that must never show on a non-English screen. */
const ENGLISH_WORDS = [
  "Approve", "Approvals", "Save", "Saved", "Cancel", "Settings", "Kids", "Kid", "Chores", "Chore", "Payout", "Payouts",
  "History", "Edit", "Pause", "Paused", "Delete", "Next", "Back", "Done", "Search", "Sort", "Sort by price", "Log out",
  "Add", "Remove", "Close", "Loading", "Submit", "Send", "Yes", "Today", "Yesterday", "Tip", "Undo", "Reject",
  "Balance", "Amount", "Language", "Categories", "Morning", "Afternoon", "Evening", "Routine", "My routines",
  "Help", "Feedback", "Members", "Tablets", "Billing", "Promotions", "Family tax", "Step", "Steps", "New chore",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "January", "February", "March", "April", "June", "July", "August", "September", "October", "November", "December",
];
const ENGLISH_PATTERNS = [/\b\d+ (minutes?|hours?|days?|weeks?) ago\b/, /\babout \d+ (hour|minute|day)/, /\bjust now\b/i, /\bsteps? done\b/i];
const FOREVER = /\bforever\b|pour toujours|para siempre|para sempre/i;
const MOJIBAKE = /Ã[\u0080-¿]|â€|ï¿½|�/;
const PRICES = /\/\s?(month|mo|mois|mes|mês)\b|per month|par mois|al mes|por mês|free trial|essai gratuit|prueba gratis|teste grátis|\btrial\b/i;

type Issue = { screen: string; kind: string; text: string };

/** English strings that a translated screen must not show, and the target language's own strings (allowed). */
async function englishReference(lang: Locale) {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  const add = (v: unknown) => {
    if (typeof v !== "string") return;
    if (/\{\w+\}/.test(v)) {
      const parts = v.split(/\{\w+\}/).map(norm);
      if (parts.join("").length >= 10) patterns.push(new RegExp(`^${v.split(/\{\w+\}/).map((p) => esc(p.replace(/\s+/g, " ").trim())).join(".+")}$`));
      return;
    }
    const n = norm(v);
    if (n.length >= 3 && /\p{L}/u.test(n)) exact.add(n);
  };
  const own = new Set<string>();
  const addOwn = (v: unknown) => typeof v === "string" && own.add(norm(v));

  Object.values(parentDicts().en).forEach(add);
  Object.values(parentDicts()[lang]).forEach(addOwn);
  Object.values(KID_DICTS.en).forEach(add);
  Object.values(KID_DICTS[lang]).forEach(addOwn);
  for (const [k, v] of Object.entries(taxPromoCopy("en"))) {
    add(v);
    addOwn((taxPromoCopy(lang) as unknown as Record<string, unknown>)[k]);
  }
  Object.values(taxPromoCopy("en").promoStatus).forEach(add);
  Object.values(taxPromoCopy(lang).promoStatus).forEach(addOwn);
  for (const c of Object.values(CATEGORY_LABELS)) {
    add(c.en);
    addOwn(c[lang]);
  }
  for (const c of Object.values(NAMED_INTERVALS)) {
    add(c.en);
    addOwn(c[lang]);
  }
  // Starter chores and their steps in English.
  const { data: tpl } = await admin.from("chore_templates").select("locale, title, description, subtasks");
  for (const row of tpl ?? []) {
    const bucket = row.locale === "en" ? add : row.locale === lang ? addOwn : null;
    if (!bucket) continue;
    bucket(row.title);
    bucket(row.description);
    for (const s of (row.subtasks as { title: string; section?: string }[] | null) ?? []) {
      bucket(s.title);
      bucket(s.section);
    }
  }
  ENGLISH_WORDS.forEach((w) => exact.add(w));
  for (const o of own) exact.delete(o);
  return { exact, patterns, own };
}

export function defineJourney(lang: Locale) {
  const cfg = CFG[lang];
  const pt = parentT(lang);
  const kt = (key: string, vars?: Record<string, string | number>) => kidT(lang, key as never, vars);
  const tp = taxPromoCopy(lang);
  const mk = marketing(lang);
  const dir = `/tmp/claude-501/journeys/${lang}`;
  mkdirSync(dir, { recursive: true });

  const id = randomUUID().slice(0, 8);
  const email = `journey-${lang}-${id}@example.test`;
  const password = `journey-${randomUUID()}`;
  const home = `${cfg.home} ${id.slice(0, 4)}`;
  const [kidA, kidB] = cfg.kids;
  const userText = new Set([home, kidA, kidB, cfg.note, cfg.promo, cfg.support, email, "First Payday"].map(norm));

  let shotNo = 0;
  const issues: Issue[] = [];
  let ref: Awaited<ReturnType<typeof englishReference>>;
  let tabletCtx: BrowserContext;
  let tablet: Page;
  let parent: Page;
  let householdId = "";
  const kidId: Record<string, string> = {};
  const titles: Record<string, string> = {};

  /** Audit the current screen and save a full-page screenshot (at each given width). */
  async function audit(page: Page, name: string, opts: { sizes?: ("phone" | "tablet")[] } = {}) {
    await page.waitForLoadState("networkidle").catch(() => {});
    const texts: string[] = await page.evaluate(() => {
      const out = new Set<string>();
      const skip = (el: Element | null) => !el || el.closest("script,style,noscript,template,[data-user-content]");
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = w.nextNode())) {
        if (skip(n.parentElement)) continue;
        // Timezone names come from the platform ("Toronto (America)").
        if (n.parentElement?.closest("option") && /\//.test((n.parentElement.closest("option") as HTMLOptionElement).value)) continue;
        const s = (n.textContent ?? "").replace(/\s+/g, " ").trim();
        if (s) out.add(s);
      }
      document.querySelectorAll("button,a,label,h1,h2,h3,h4,th,td,li,p,span,dt,dd,[role=button],[role=radio]").forEach((el) => {
        const s = ((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim();
        if (s && s.length < 160) out.add(s);
      });
      document.querySelectorAll("[aria-label],[placeholder],[title],img[alt]").forEach((el) => {
        for (const a of ["aria-label", "placeholder", "title", "alt"]) {
          const v = el.getAttribute(a);
          if (v?.trim()) out.add(v.trim());
        }
      });
      out.add(document.title);
      return [...out];
    });
    const add = (kind: string, text: string) => {
      if (!issues.some((i) => i.kind === kind && i.text === text)) issues.push({ screen: name, kind, text });
    };
    for (const raw of texts) {
      if (FOREVER.test(raw)) add("forever", raw);
      if (MOJIBAKE.test(raw)) add("mojibake", raw);
      if (PRICES.test(raw)) add("price/trial", raw);
      if (lang === "en") continue;
      const s = norm(raw);
      if (!s || userText.has(s) || [...userText].some((u) => u.length > 3 && s.includes(u) && s.length < u.length + 4)) continue;
      if (ref.exact.has(s)) add("english", raw);
      else if (!ref.own.has(s) && ref.patterns.some((p) => p.test(raw.replace(/\s+/g, " ").trim()))) add("english", raw);
      else if (ENGLISH_PATTERNS.some((p) => p.test(raw))) add("english", raw);
    }
    const sizes = opts.sizes ?? ["phone", "tablet"];
    const original = page.viewportSize();
    for (const size of sizes) {
      const vp = size === "phone" ? PHONE : TABLET;
      if (original?.width !== vp.width) await page.setViewportSize(vp);
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) add("overflow", `${size}: ${overflow}px wider than the screen`);
      shotNo++;
      await page.screenshot({ path: `${dir}/${String(shotNo).padStart(2, "0")}-${name}-${size}.png`, fullPage: true });
    }
    if (original && page.viewportSize()?.width !== original.width) await page.setViewportSize(original);
  }

  async function mail(query: string, timeout = 30_000): Promise<{ ID: string; Subject: string }[]> {
    let found: { ID: string; Subject: string }[] = [];
    await expect
      .poll(
        async () => {
          const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(query)}`);
          found = ((await res.json()) as { messages: { ID: string; Subject: string }[] }).messages ?? [];
          return found.length;
        },
        { timeout, message: `mail for ${query}` },
      )
      .toBeGreaterThan(0);
    return found;
  }
  async function mailHtml(msgId: string): Promise<string> {
    return ((await (await fetch(`${MAILPIT}/api/v1/message/${msgId}`)).json()) as { HTML: string }).HTML;
  }
  async function auditHtml(browser: Browser, html: string, name: string) {
    const page = await (await browser.newContext({ viewport: PHONE })).newPage();
    await page.setContent(html);
    await audit(page, name, { sizes: ["phone"] });
    await page.context().close();
  }

  async function openBoard(name: string) {
    await tablet.goto("/kids");
    await tablet.waitForLoadState("networkidle");
    await tablet.getByRole("button", { name: new RegExp(name) }).click();
    await expect(tablet.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 40_000 });
  }
  const card = (key: string) => tablet.getByRole("button", { name: titles[key]!, exact: true });
  const pill = (c: string) => tablet.getByRole("button", { name: `${CATEGORY_LABELS[c]!.emoji} ${CATEGORY_LABELS[c]![lang]}`, exact: true });
  const allPill = () => tablet.getByRole("button", { name: `🌈 ${kt("kid.allCategories")}`, exact: true });

  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test.beforeAll(async () => {
    ref = await englishReference(lang);
  });

  test(`${lang} 1. public home`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: TABLET, locale: "en-US" })).newPage();
    await page.goto(lang === "en" ? "/" : `/${lang}`);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(cfg.hero);
    const footer = page.getByRole("contentinfo");
    for (const [l, n] of Object.entries({ en: "English", fr: "Français", es: "Español", pt: "Português" })) {
      await expect(footer.getByRole("link", { name: n, exact: true })).toHaveAttribute("href", l === "en" ? "/" : `/${l}`);
    }
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toMatch(/forever|pour toujours|para siempre|para sempre/);
    expect(body).not.toMatch(/\$\s?5\b|\/\s?(month|mois|mes|mês)/);
    await audit(page, "home");
    await page.context().close();
  });

  test(`${lang} 2-3. signup and onboarding`, async ({ browser }) => {
    tabletCtx = await browser.newContext({ viewport: PHONE, locale: "en-US" });
    tablet = await tabletCtx.newPage();
    await tablet.goto(lang === "en" ? "/signup" : `/${lang}/signup`);
    if (lang !== "en") await expect(tablet).toHaveURL(new RegExp(`/signup\\?lang=${lang}`));
    await expect(tablet.getByRole("heading", { name: mk.auth.signupTitle })).toBeVisible();
    await audit(tablet, "signup");
    await tablet.getByLabel(mk.auth.email).fill(email);
    await tablet.getByLabel(mk.auth.password).fill(password);
    await tablet.getByRole("checkbox").check();
    await tablet.getByRole("button", { name: mk.auth.createButton }).click();

    // Home
    await expect(tablet.getByRole("heading", { name: pt("a.onb.home.title") })).toBeVisible({ timeout: 60_000 });
    await expect(tablet.getByLabel(pt("a.onb.home.language"))).toHaveValue(lang);
    await tablet.getByLabel(pt("a.onb.home.name")).fill(home);
    await tablet.getByLabel(pt("a.onb.home.currency")).selectOption(cfg.currency);
    await audit(tablet, "onb-home");
    await tablet.getByRole("button", { name: pt("a.onb.home.next") }).click();

    // Kids: a fox buddy and a cropped photo
    await expect(tablet.getByRole("heading", { name: pt("a.onb.kids.title") })).toBeVisible({ timeout: 30_000 });
    await tablet.getByLabel(pt("a.onb.kids.kidName", { n: 1 })).fill(kidA);
    await tablet.getByRole("button", { name: pt("a.onb.kids.addAnother") }).click();
    await tablet.getByLabel(pt("a.onb.kids.kidName", { n: 2 })).fill(kidB);
    await tablet.getByRole("button", { name: pt("a.avatar.choose") }).first().click();
    const sheet = tablet.getByRole("dialog", { name: pt("a.avatar.choose") });
    await expect(sheet.getByRole("heading", { name: pt("a.avatar.chooseFor", { name: kidA }) })).toBeVisible();
    await audit(tablet, "onb-avatar-sheet");
    await sheet.getByRole("button", { name: PRESET_NAMES.fox[lang], exact: true }).click();
    await tablet.locator('input[type="file"]').nth(1).setInputFiles("tests/fixtures/wide-photo.jpg");
    const crop = tablet.getByRole("dialog", { name: pt("a.avatar.adjustAria") });
    await expect(crop.getByRole("heading", { name: pt("a.avatar.adjustTitle") })).toBeVisible();
    await crop.getByRole("button", { name: pt("a.avatar.zoomIn") }).click();
    await crop.getByRole("button", { name: pt("a.avatar.zoomIn") }).click();
    const box = (await crop.locator("div.touch-none").boundingBox())!;
    await tablet.mouse.move(box.x + 140, box.y + 140);
    await tablet.mouse.down();
    await tablet.mouse.move(box.x + 80, box.y + 120, { steps: 5 });
    await tablet.mouse.up();
    await audit(tablet, "onb-photo-crop");
    await crop.getByRole("button", { name: pt("a.avatar.usePhoto") }).click();
    await expect(crop).toHaveCount(0);
    await audit(tablet, "onb-kids");
    await tablet.getByRole("button", { name: pt("a.onb.kids.next") }).click();

    // Chores: every template is preselected, including the three routines
    await expect(tablet.getByRole("heading", { name: pt("a.onb.chores.title") })).toBeVisible({ timeout: 30_000 });
    const { data: tpl } = await admin.from("chore_templates").select("key, title").eq("locale", lang);
    for (const r of tpl ?? []) titles[r.key] = r.title;
    for (const key of ["morning_routine", "daily_routine", "evening_routine"]) {
      await expect(tablet.getByRole("button", { name: new RegExp(`^${esc(titles[key]!)}`) })).toHaveAttribute("aria-pressed", "true");
    }
    await audit(tablet, "onb-chores");
    await tablet.getByRole("button", { name: pt("a.onb.chores.next") }).click();

    // Tablet step, with the optional family tax turned on
    await expect(tablet.getByRole("heading", { name: pt("a.onb.tablet.title") })).toBeVisible({ timeout: 30_000 });
    await expect(tablet.getByText(tp.taxOnboardingTitle)).toBeVisible();
    await tablet.getByLabel(tp.taxToggle).check();
    await expect(tablet.getByRole("alert").filter({ hasText: tp.saved })).toBeVisible();
    await audit(tablet, "onb-tablet");

    const { data: hh } = await admin.from("households").select("id, locale, currency, tax_enabled, tax_percent").eq("name", home).single();
    expect(hh).toMatchObject({ locale: lang, currency: cfg.currency, tax_enabled: true, tax_percent: 10 });
    householdId = hh!.id;
    const { data: kids } = await admin.from("kids").select("id, name, avatar_path").eq("household_id", householdId).order("sort_order");
    for (const k of kids ?? []) kidId[k.name] = k.id;
    expect(kids?.find((k) => k.name === kidA)?.avatar_path).toBe("preset:fox");
    expect(kids?.find((k) => k.name === kidB)?.avatar_path).toMatch(/\.webp|^[^p]/);
    const { count } = await admin.from("chores").select("id", { count: "exact", head: true }).eq("household_id", householdId).not("template_key", "is", null);
    expect(count).toBeGreaterThan(15);

    await tablet.setViewportSize(TABLET);
    await tablet.getByRole("button", { name: pt("a.onb.tablet.use") }).click();
    await expect(tablet.getByRole("heading", { name: kt("kid.whoIsHere") })).toBeVisible({ timeout: 30_000 });
  });

  test(`${lang} 4. kids' tablet`, async () => {
    await expect(tablet.getByRole("button", { name: new RegExp(kidA) })).toContainText("🦊");
    await expect(tablet.getByRole("button", { name: new RegExp(kidB) }).locator("img")).toHaveCount(1);
    await audit(tablet, "kid-picker");
    await openBoard(kidA);
    await expect(tablet.getByText(kt("kid.inMyBank"))).toBeVisible();

    // Routines have their own section
    const routines = tablet.locator("section", { has: tablet.getByRole("heading", { name: kt("kid.section.routines") }) });
    await expect(routines).toBeVisible();
    for (const key of ["morning_routine", "daily_routine", "evening_routine"]) await expect(routines.getByRole("button", { name: new RegExp(esc(titles[key]!)) })).toBeVisible();
    await expect(routines.getByText(new RegExp(`${esc(kt("kid.routine"))}`)).first()).toBeVisible();

    // Category pills in the kid's language
    for (const c of ["car_garage", "kitchen", "cleaning"]) await expect(pill(c)).toBeVisible();
    await expect(allPill()).toBeVisible();
    await audit(tablet, "kid-board", { sizes: ["tablet", "phone"] });
    await pill("car_garage").click();
    await expect(card("garage_sweep")).toBeVisible();
    await expect(card("make_bed")).toHaveCount(0);
    await audit(tablet, "kid-board-category", { sizes: ["tablet"] });
    await allPill().click();

    // Sort by price
    const sort = tablet.getByRole("button", { name: kt("kid.sortLabel") });
    await expect(sort).toContainText(kt("kid.sortPrice"));
    await sort.click();
    await expect(sort).toContainText(kt("kid.sortAsc"));
    await sort.click();
    await expect(sort).toContainText(kt("kid.sortDesc"));
    await sort.click();

    // Search ignores accents
    await tablet.getByRole("searchbox").fill(cfg.search.q);
    await tablet.getByRole("button", { name: new RegExp(esc(kt("kid.search"))) }).click();
    await expect(tablet.getByRole("button", { name: new RegExp(esc(titles[cfg.search.key]!)) }).first()).toBeVisible();
    await expect(card("bin_boss")).toHaveCount(0);
    await audit(tablet, "kid-search", { sizes: ["tablet"] });
    await tablet.getByRole("searchbox").fill("zzzq");
    await expect(tablet.getByText(kt("kid.searchNone", { q: "zzzq" }))).toBeVisible();
    await tablet.getByRole("searchbox").fill("");

    // Daily routine: sectioned checklist
    await card("daily_routine").click();
    const daily = tablet.getByRole("dialog", { name: titles.daily_routine });
    const { data: dr } = await admin.from("chore_templates").select("subtasks").eq("locale", lang).eq("key", "daily_routine").single();
    const sections = [...new Set((dr!.subtasks as { section?: string }[]).map((s) => s.section).filter(Boolean))] as string[];
    expect(sections.length).toBe(3);
    for (const s of sections) await expect(daily.getByRole("heading", { name: new RegExp(esc(s)) })).toBeVisible();
    await expect(daily.getByRole("checkbox")).toHaveCount(14);
    await expect(daily.getByText(kt("kid.steps", { done: 0, total: 14 }))).toBeVisible();
    await daily.getByRole("checkbox").first().click();
    await expect(daily.getByText(kt("kid.stepsLeft", { count: 13 }))).toBeVisible();
    await expect(daily.getByRole("button", { name: new RegExp(esc(kt("kid.didIt").replace(/ ✅$/, ""))) })).toBeDisabled();
    await audit(tablet, "kid-routine-sheet", { sizes: ["tablet", "phone"] });
    await daily.getByRole("button", { name: kt("kid.notYet") }).click();

    // A regular chore
    await card("bin_boss").click();
    await audit(tablet, "kid-confirm-sheet", { sizes: ["tablet"] });
    const sent = tablet.waitForResponse((r) => r.url().includes("/api/kiosk/submit"));
    await tablet.getByRole("button", { name: new RegExp(esc(kt("kid.didIt").replace(/ ✅$/, ""))) }).click();
    expect((await sent).status()).toBe(200);
    await expect(tablet.getByText(kt("kid.sent"))).toBeVisible();

    // The morning routine, every step ticked
    await card("morning_routine").click();
    const am = tablet.getByRole("dialog", { name: titles.morning_routine });
    const boxes = am.getByRole("checkbox");
    await expect(boxes).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await boxes.nth(i).click();
      await expect(boxes.nth(i)).toHaveAttribute("aria-checked", "true");
    }
    await expect(am.getByText(kt("kid.stepsAllDone"))).toBeVisible();
    await am.getByRole("button", { name: new RegExp(esc(kt("kid.didIt").replace(/ ✅$/, ""))) }).click();
    await expect(tablet.getByText(kt("kid.sent"))).toBeVisible();
    await expect(tablet.getByRole("heading", { name: new RegExp(esc(norm(kt("kid.section.waiting")))) })).toBeVisible();
    await audit(tablet, "kid-board-waiting", { sizes: ["tablet"] });
  });

  test(`${lang} 5. review email: one tap signs the parent in`, async ({ browser }) => {
    const [msg] = await mail(`to:${email}`);
    const html = await mailHtml(msg!.ID);
    await auditHtml(browser, html, "email-review");
    expect(html).toContain(kidA);
    expect(html).toContain(titles.bin_boss!);
    if (lang !== "en") expect(msg!.Subject).not.toMatch(/ready for review|waiting|approve/i);
    const href = /href="([^"]*\/auth\/confirm[^"]*)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
    expect(href, "one-tap login link").toBeTruthy();
    const link = new URL(href!);
    const phone = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true, locale: "en-US" });
    parent = await phone.newPage();
    await parent.goto(`${link.pathname}${link.search}`);
    await expect(parent).toHaveURL(/\/admin\/approvals$/, { timeout: 45_000 });
    await expect(parent.getByRole("heading", { level: 1 })).toHaveText(pt("a.appr.title"));
  });

  test(`${lang} 6. approve with a tip, undo as a revision, promotion, taxed payout`, async () => {
    const balance = async (name: string) => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", kidId[name]!).single()).data?.balance_cents ?? 0;
    const price = (c: number) => formatMoney(c, cfg.currency, lang);
    const bin = parent.locator("li", { hasText: titles.bin_boss! }).first();
    await expect(bin).toBeVisible();
    await expect(parent.getByTestId("approval-steps")).toBeVisible();
    await audit(parent, "approvals");

    // Tip: the middle chip is +1
    const chips = bin.getByRole("group").getByRole("button");
    await chips.nth(1).click();
    await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
    await audit(parent, "approvals-tip", { sizes: ["phone"] });
    await bin.getByRole("button", { name: /^✓/ }).click();
    await expect.poll(() => balance(kidA)).toBe(200);
    const am = parent.locator("li", { hasText: titles.morning_routine! }).first();
    await am.getByRole("button", { name: /^✓/ }).click();
    await expect(parent.getByText(pt("a.appr.emptyTitle"))).toBeVisible();
    await expect.poll(() => balance(kidA)).toBe(210);

    // Undo → revision with a note
    await parent.reload();
    const row = parent.locator("li", { hasText: titles.bin_boss! }).first();
    await row.getByRole("button", { name: pt("a.recent.undo") }).click();
    await audit(parent, "approvals-undo", { sizes: ["phone"] });
    await row.getByRole("button", { name: pt("a.recent.askRevision") }).click();
    await row.getByPlaceholder(pt("a.recent.typeNote")).fill(cfg.note);
    await audit(parent, "approvals-revision", { sizes: ["phone"] });
    await row.getByRole("button", { name: pt("a.recent.sendRevision") }).click();
    await expect(parent.getByText(cfg.note, { exact: false }).first()).toBeVisible();
    await expect.poll(() => balance(kidA)).toBe(10);
    await audit(parent, "approvals-after-undo");

    // Kid sees the badge and the banner, fixes it
    await tablet.goto("/kids");
    await tablet.waitForLoadState("networkidle");
    await expect(tablet.getByRole("button", { name: new RegExp(kidA) })).toContainText("🛠 1");
    await tablet.getByRole("button", { name: new RegExp(kidA) }).click();
    await expect(tablet.getByText(kt("kid.revisionTitle", { count: 1 }))).toBeVisible({ timeout: 40_000 });
    await expect(tablet.getByText(cfg.note).first()).toBeVisible();
    await audit(tablet, "kid-revision", { sizes: ["tablet", "phone"] });
    await tablet.locator("#needs-fixing").getByRole("button", { name: new RegExp(esc(titles.bin_boss!)) }).first().click();
    await tablet.getByRole("button", { name: new RegExp(`^${esc(kt("kid.fixedIt"))}`) }).click();
    await expect(tablet.getByText(kt("kid.resent"))).toBeVisible();
    await expect(tablet.locator("#needs-fixing")).toHaveCount(0);

    await parent.goto("/admin/approvals");
    await expect(parent.getByText(pt("a.appr.fixed"))).toBeVisible();
    await audit(parent, "approvals-fixed", { sizes: ["phone"] });
    await parent.locator("li", { hasText: titles.bin_boss! }).first().getByRole("button", { name: /^✓/ }).click();
    await expect(parent.getByText(pt("a.appr.emptyTitle"))).toBeVisible();
    await expect.poll(() => balance(kidA)).toBe(110);

    // +20% promotion, live now
    await parent.goto("/admin/settings/promotions");
    await expect(parent.getByRole("heading", { level: 1 })).toBeVisible();
    await parent.getByLabel(tp.promoName).fill(cfg.promo);
    await parent.getByLabel(tp.promoBonus).selectOption("percent");
    await parent.getByRole("spinbutton", { name: new RegExp(`^${esc(tp.promoPercentValue)}`) }).fill("20");
    await audit(parent, "promo-form");
    await parent.getByRole("button", { name: tp.promoCreate }).click();
    await expect(parent.getByText(tp.promoStatus.active)).toBeVisible();
    await audit(parent, "promo-live");
    await openBoard(kidA);
    await expect(tablet.getByText(new RegExp(`^${esc(kt("kid.promoBannerPercent", { percent: 20, time: "§" })).split("§")[0]!}`))).toBeVisible();
    await expect(tablet.getByText(new RegExp(esc(kt("kid.promoEndsIn", { time: "§" }).split("§")[0]!)))).toBeVisible();
    await audit(tablet, "kid-promo", { sizes: ["tablet", "phone"] });

    // Payout with the family tax
    await parent.goto("/admin/payouts");
    await parent.getByRole("button", { name: new RegExp(kidA) }).first().click();
    const breakdown = parent.getByLabel(pt("a.pay.breakdown"));
    await expect(breakdown).toContainText(tp.gross);
    await expect(breakdown).toContainText(tp.taxLine(10));
    await expect(breakdown).toContainText(tp.net);
    await expect(breakdown).toContainText(price(11));
    await expect(breakdown).toContainText(price(99));
    await audit(parent, "payout");
    await parent.getByRole("button", { name: tp.payNet(price(99), kidA) }).click();
    await expect(parent.getByText(tp.paid(price(99), kidA, price(11)))).toBeVisible();
    await expect.poll(() => balance(kidA)).toBe(0);
    await parent.reload();
    await expect(parent.getByTestId("family-pot")).toHaveText(price(11));
    await audit(parent, "payout-done");

    // Kid's bank: taxes paid and why
    await openBoard(kidA);
    await tablet.getByRole("button", { name: kt("kid.myMoney") }).click();
    const taxes = tablet.getByTestId("kid-taxes");
    await expect(taxes).toContainText(kt("kid.taxesPaid", { amount: price(11) }).replace(/ /g, " ").split(":")[0]!);
    await expect(taxes).toContainText(kt("kid.taxWhy", { percent: 10 }).slice(0, 25));
    await expect(tablet.getByRole("dialog")).toContainText(kt("kid.taxRow"));
    await audit(tablet, "kid-bank", { sizes: ["tablet", "phone"] });
  });

  test(`${lang} 6b. every parent screen`, async () => {
    const pages: [string, string][] = [
      ["/admin/chores", "admin-chores"],
      ["/admin/kids", "admin-kids"],
      [`/admin/kids/${kidId[kidA]}`, "admin-kid-a"],
      [`/admin/kids/${kidId[kidB]}`, "admin-kid-b"],
      ["/admin/history", "admin-history"],
      ["/admin/settings", "admin-settings"],
      ["/admin/settings/members", "admin-members"],
      ["/admin/settings/devices", "admin-tablets"],
      ["/admin/settings/billing", "admin-billing"],
    ];
    for (const [path, name] of pages) {
      await parent.goto(path);
      await expect(parent.locator("main")).toBeVisible();
      await audit(parent, name);
    }
    // Chore editor (new chore sheet)
    await parent.goto("/admin/chores");
    const edit = parent.getByRole("button", { name: pt("b.chores.edit") }).first();
    if (await edit.count()) {
      await edit.click();
      await audit(parent, "admin-chore-edit", { sizes: ["phone"] });
    }
  });

  test(`${lang} 7. help & feedback reaches the team`, async () => {
    await parent.goto("/admin/support");
    await parent.getByRole("radio", { name: pt("b.support.pick.bug") }).click();
    await parent.getByLabel(pt("b.support.yourMessage")).fill(cfg.support);
    await audit(parent, "support-form");
    await parent.getByRole("button", { name: pt("b.support.send") }).click();
    await expect(parent.getByText(pt("b.support.thanks", { email }))).toBeVisible();
    await parent.reload();
    await expect(parent.getByText(cfg.support)).toBeVisible();
    await audit(parent, "support-sent");
    const found = await mail(`to:info@firstpayday.app ${email}`);
    const html = await mailHtml(found[0]!.ID);
    expect(html).toContain(cfg.support.replace(/'/g, "&#39;").slice(0, 20).split("&")[0]);
  });

  test(`${lang} 8. weekly report is in the household language`, async ({ browser }) => {
    const res = await fetch(`${test.info().project.use.baseURL}/api/cron/weekly-report?preview=${householdId}`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    writeFileSync(`${dir}/weekly-report.html`, html);
    expect(html).toContain(kidA);
    await auditHtml(browser, html, "email-weekly");
  });

  test(`${lang} 9. no English leftovers, mojibake, forever words or overflow`, async () => {
    writeFileSync(`${dir}/issues.json`, JSON.stringify(issues, null, 2));
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });
}
