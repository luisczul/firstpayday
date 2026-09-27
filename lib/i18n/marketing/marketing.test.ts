import { describe, expect, it } from "vitest";
import { SITE_LANGS, authHref, hreflangAlternates, localePath, marketing, splitLocalePath } from "./index";

describe("public-site URLs", () => {
  it("splits and builds language prefixes", () => {
    expect(splitLocalePath("/")).toEqual({ lang: "en", path: "/", prefixed: false });
    expect(splitLocalePath("/fr")).toEqual({ lang: "fr", path: "/", prefixed: true });
    expect(splitLocalePath("/es/terms")).toEqual({ lang: "es", path: "/terms", prefixed: true });
    expect(splitLocalePath("/france")).toEqual({ lang: "en", path: "/france", prefixed: false });
    expect(splitLocalePath("/admin")).toEqual({ lang: "en", path: "/admin", prefixed: false });
    expect(localePath("en", "/terms")).toBe("/terms");
    expect(localePath("pt", "/")).toBe("/pt");
    expect(localePath("fr", "/paid-chores-list")).toBe("/fr/paid-chores-list");
    expect(authHref("en", "/signup")).toBe("/signup");
    expect(authHref("es", "/signup")).toBe("/signup?lang=es");
    expect(hreflangAlternates("/")).toEqual({ en: "/", fr: "/fr", es: "/es", pt: "/pt", "x-default": "/" });
  });
});

/** Every string a dictionary can render, with billing off (the current, free product). */
function freeCopy(lang: (typeof SITE_LANGS)[number]): string {
  const m = marketing(lang);
  const brand = { name: "First Payday", entity: "First Payday", email: "info@firstpayday.app" };
  const { paidSection, pricing, faqCost, ...rest } = m;
  void paidSection;
  void pricing;
  return JSON.stringify([rest, faqCost.q, faqCost.free, m.guides(false), m.legal.terms(brand, false), m.legal.privacy(brand, false), m.money(2)]);
}

describe("public-site copy rules", () => {
  it.each(SITE_LANGS)("%s: no 'forever' promises and no adult-sized prices while free", (lang) => {
    expect(freeCopy(lang)).not.toMatch(/forever|toujours|siempre|sempre|\$5|\$\s?[3-9]\b|\b[3-9]\s?\$/i);
  });

  it.each(SITE_LANGS)("%s: guides cover the same slugs and table shape as English", (lang) => {
    const en = marketing("en").guides(false);
    const other = marketing(lang).guides(false);
    expect(other.map((g) => g.slug)).toEqual(en.map((g) => g.slug));
    expect(other.map((g) => g.sections.length)).toEqual(en.map((g) => g.sections.length));
  });

  it("translations say the English legal text controls", () => {
    expect(marketing("en").legal.controlling).toBe("");
    for (const lang of ["fr", "es", "pt"] as const) expect(marketing(lang).legal.controlling).not.toBe("");
  });
});
