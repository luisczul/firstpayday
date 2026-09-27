import type { Locale } from "@/lib/i18n";
import * as A from "./areaA";
import * as B from "./areaB";
import * as C from "./areaC";

// Parent-facing (admin + onboarding) strings, in the household's language.
const DICTS = {
  en: { ...A.en, ...B.en, ...C.en },
  fr: { ...A.fr, ...B.fr, ...C.fr },
  es: { ...A.es, ...B.es, ...C.es },
  pt: { ...A.pt, ...B.pt, ...C.pt },
} satisfies Record<Locale, Record<string, string>>;

export type ParentKey = A.AreaAKey | B.AreaBKey | C.AreaCKey;

/** pt("fr")("a.approvals.title", { count: 2 }) — falls back to English, then to the key. */
export function parentT(locale: Locale) {
  const dict = DICTS[locale] as Record<string, string>;
  const fallback = DICTS.en as Record<string, string>;
  return (key: ParentKey, vars?: Record<string, string | number>): string => {
    let s = dict[key] ?? fallback[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export function parentDicts() {
  return DICTS;
}
