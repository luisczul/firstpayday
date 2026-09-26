import en from "./en.json";
import fr from "./fr.json";

export type Locale = "en" | "fr";
export type MessageKey = keyof typeof en;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, fr };

export function asLocale(value: string | null | undefined): Locale {
  return value === "fr" ? "fr" : "en";
}

export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale][key] ?? dictionaries.en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** Bind a locale once: const tr = translator("fr"); tr("kid.back"). */
export function translator(locale: Locale) {
  return (key: MessageKey, vars?: Record<string, string | number>) => t(locale, key, vars);
}

export function weekdayName(locale: Locale, weekday: number): string {
  // Jan 4 2026 is a Sunday.
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 0, 4 + weekday)),
  );
}
