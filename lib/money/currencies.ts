import { intlLocale } from "@/lib/i18n";

/** Shown first: the currencies most First Payday families use. */
const COMMON = ["CAD", "USD", "EUR", "GBP", "MXN", "BRL", "AUD", "NZD", "CHF", "COP", "ARS", "CLP", "PEN"] as const;

/**
 * Every currency the browser/server knows that uses cents (2 decimals), so prices like $0.50 work.
 * The household currency is chosen on its own: it never follows the language.
 */
export function currencyOptions(locale: string): { code: string; label: string; common: boolean }[] {
  let all: string[] = [];
  try {
    all = Intl.supportedValuesOf("currency");
  } catch {
    all = [...COMMON];
  }
  const names = new Intl.DisplayNames([intlLocale(locale)], { type: "currency" });
  const twoDecimals = (code: string) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits === 2;
    } catch {
      return false;
    }
  };
  const label = (code: string) => `${code} · ${names.of(code) ?? code}`;
  const common = COMMON.map((code) => ({ code, label: label(code), common: true }));
  const rest = all
    .filter((c) => !(COMMON as readonly string[]).includes(c) && twoDecimals(c))
    .map((code) => ({ code, label: label(code), common: false }))
    .sort((a, b) => a.label.localeCompare(b.label, intlLocale(locale)));
  return [...common, ...rest];
}

export function isKnownCurrency(code: string): boolean {
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return /^[A-Z]{3}$/.test(code);
  } catch {
    return false;
  }
}

export const CURRENCY_COPY: Record<string, { common: string; all: string; hint: string }> = {
  en: { common: "Most used", all: "All currencies", hint: "Any currency: it's up to you." },
  fr: { common: "Les plus utilisées", all: "Toutes les devises", hint: "N'importe quelle devise : à vous de choisir." },
  es: { common: "Las más usadas", all: "Todas las monedas", hint: "Cualquier moneda: tú eliges." },
  pt: { common: "Mais usadas", all: "Todas as moedas", hint: "Qualquer moeda: você escolhe." },
};
