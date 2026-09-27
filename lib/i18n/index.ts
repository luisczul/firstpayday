import en from "./en.json";
import fr from "./fr.json";
import es from "./es.json";
import pt from "./pt.json";

export type Locale = "en" | "fr" | "es" | "pt";
export type MessageKey = keyof typeof en;

export const LOCALES: readonly Locale[] = ["en", "fr", "es", "pt"] as const;

/** Native names, for language pickers. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  pt: "Português",
};

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, fr, es, pt };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function asLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : "en";
}

/** BCP 47 tag for Intl formatting (dates, numbers) in a locale. */
export function intlLocale(locale: string | null | undefined): string {
  switch (locale) {
    case "fr":
      return "fr-CA";
    case "es":
      // Latin American Spanish: "$1,234.50", "10:00 p.m." (plain "es" formats like Spain).
      return "es-419";
    case "pt":
      return "pt-BR";
    default:
      return "en-CA";
  }
}

/** Best app locale for a browser language tag (navigator.language). */
export function localeFromBrowser(tag: string | null | undefined): Locale {
  const base = (tag ?? "").toLowerCase().slice(0, 2);
  return isLocale(base) ? base : "en";
}

export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale]?.[key] ?? dictionaries.en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** Bind a locale once: const tr = translator("fr"); tr("kid.back"). */
export function translator(locale: Locale) {
  return (key: MessageKey, vars?: Record<string, string | number>) => t(locale, key, vars);
}

export function weekdayName(locale: Locale, weekday: number): string {
  // Jan 4 2026 is a Sunday.
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 0, 4 + weekday)),
  );
}
