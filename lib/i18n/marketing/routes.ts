// Public-site URL scheme (edge-safe: imported by middleware, so no dictionaries here).
//
//   English  → /, /terms, /privacy, /chore-chart-app …   (x-default)
//   Others   → /fr, /fr/terms, /es/allowance-app-for-kids, /pt/privacy …
//
// Prefixed URLs are rewritten by middleware to the unprefixed route, with the
// language passed in the LANG_HEADER request header (read by the root layout
// for <html lang> and by each public page). Auth pages use ?lang= instead.

export type SiteLang = "en" | "fr" | "es" | "pt";

export const SITE_LANGS: readonly SiteLang[] = ["en", "fr", "es", "pt"] as const;
export const PREFIXED_LANGS: readonly SiteLang[] = ["fr", "es", "pt"] as const;

/** Request header carrying the public-site language (always overwritten by middleware). */
export const LANG_HEADER = "x-fp-lang";
/** Remembers the language a parent signed up in, so onboarding can default the household to it. */
export const SIGNUP_LANG_COOKIE = "fp_signup_lang";

export const GUIDE_SLUGS = ["chore-chart-app", "allowance-app-for-kids", "paid-chores-list"] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];

/** Public pages that exist in every language (English path). */
export const PUBLIC_PATHS: readonly string[] = ["/", "/terms", "/privacy", "/pricing", ...GUIDE_SLUGS.map((s) => `/${s}`)];
/** Auth pages localized through ?lang=. */
export const AUTH_PATHS: readonly string[] = ["/signup", "/login", "/reset", "/reset/update"];

export function isSiteLang(value: unknown): value is SiteLang {
  return typeof value === "string" && (SITE_LANGS as readonly string[]).includes(value);
}

/** "/fr/terms" → { lang: "fr", path: "/terms", prefixed: true }; "/terms" → { lang: "en", path: "/terms", prefixed: false }. */
export function splitLocalePath(pathname: string): { lang: SiteLang; path: string; prefixed: boolean } {
  const m = /^\/(fr|es|pt|en)(\/.*)?$/.exec(pathname);
  if (!m) return { lang: "en", path: pathname, prefixed: false };
  return { lang: m[1] as SiteLang, path: m[2] && m[2] !== "/" ? m[2] : "/", prefixed: true };
}

/** Public page URL in a language: ("fr", "/terms") → "/fr/terms"; ("en", "/") → "/". */
export function localePath(lang: SiteLang, path: string): string {
  if (lang === "en") return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

/** Auth page URL in a language: ("fr", "/signup") → "/signup?lang=fr". */
export function authHref(lang: SiteLang, path: string): string {
  return lang === "en" ? path : `${path}?lang=${lang}`;
}

/** hreflang map for metadata.alternates.languages. */
export function hreflangAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of SITE_LANGS) out[l] = localePath(l, path);
  out["x-default"] = localePath("en", path);
  return out;
}
