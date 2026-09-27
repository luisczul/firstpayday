import type { GuideSlug } from "./routes";

/** Values substituted into legal text. */
export interface BrandVars {
  name: string;
  entity: string;
  email: string;
}

/** One block of a legal page. `contact` renders its text followed by the support email link. */
export interface LegalBlock {
  h?: string;
  p?: string;
  ul?: string[];
  contact?: string;
}

export interface GuideSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface Guide {
  slug: GuideSlug;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: GuideSection[];
  faq: [string, string][];
}

type Item = readonly [emoji: string, title: string, body: string];

/**
 * Public-site copy for one language. Strings may use **bold** (rendered by <Rich>).
 * Billing-dependent copy comes in pairs (`…Free` / `…Paid`); pick with billingEnabled().
 * Copy rules: never promise anything "forever"; no prices or trials while billing is off.
 */
export interface MarketingDict {
  /** Open Graph locale, e.g. "fr_CA". */
  ogLocale: string;
  /** Kid-sized example amount in the local style: 2 → "$2" / "2 $" / "R$ 2". */
  money: (amount: number) => string;
  meta: {
    siteTitle: string;
    siteDescription: string;
    homeTitle: string;
    homeDescription: string;
    ogAlt: string;
    ogTagline: string;
    keywords: string[];
  };
  nav: { home: string; pricing: string; login: string; startFree: string; startShort: string; language: string };
  footer: { choreChart: string; allowance: string; paidChores: string; terms: string; privacy: string; languages: string };
  /** Shown on the English home page to visitors whose browser prefers this language. */
  suggest: { prompt: string; yes: string; dismiss: string };
  hero: {
    h1Start: string;
    h1Accent: string;
    lead: string;
    seePricing: string;
    noteFree: string;
    notePaid: string;
    tabletLabel: string;
    waiting: string;
    newRow: string;
    didIt: string;
    perFloor: string;
    cards: [string, string, string, string];
  };
  why: { title: string; lead: string; reasons: Item[] };
  how: { title: string; step: string; steps: Item[] };
  features: Item[];
  freeSection: { title: string; body: string; cta: string };
  paidSection: { title: string; body: string; cta: string };
  faqTitle: string;
  faqCost: { q: string; free: string; paid: string };
  faq: [string, string][];
  closing: { title: string; tagFree: string; tagPaid: string };
  jsonLdDescription: string;
  guideUi: { questions: string; tryFree: string; moreGuides: string };
  guides: (billing: boolean) => Guide[];
  legal: {
    draft: string;
    updated: string;
    /** Empty in English; elsewhere, one line saying the English version controls. */
    controlling: string;
    termsTitle: string;
    privacyTitle: string;
    terms: (b: BrandVars, billing: boolean) => LegalBlock[];
    privacy: (b: BrandVars, billing: boolean) => LegalBlock[];
  };
  auth: {
    loginTitle: string;
    loginMeta: string;
    newHere: string;
    createFreeLink: string;
    signupTitle: string;
    signupMeta: string;
    signupLeadFree: string;
    signupLeadPaid: string;
    haveAccount: string;
    loginLink: string;
    email: string;
    password: string;
    passwordHint: string;
    acceptBefore: string;
    termsLink: string;
    and: string;
    privacyLink: string;
    acceptAfter: string;
    creating: string;
    createButton: string;
    loggingIn: string;
    loginButton: string;
    magicLink: string;
    forgot: string;
    linkExpired: string;
    resetTitle: string;
    resetButton: string;
    newPasswordTitle: string;
    newPassword: string;
    savePassword: string;
  };
  pricing: {
    metaTitle: string;
    metaDescription: string;
    h1: string;
    lead: string;
    faqTitle: string;
    faq: [string, string][];
    table: {
      simple: string;
      firstKidFree: string;
      everyFeature: string;
      perExtraKid: string;
      terms: string;
      features: string[];
      startFree: string;
      whatWouldIPay: string;
      howManyKids: string;
      fewer: string;
      more: string;
      free: string;
      perMonth: string;
      oneFree: string;
      breakdown: string;
    };
  };
}
