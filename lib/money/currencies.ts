import { intlLocale } from "@/lib/i18n";

/** Shown first: the currencies most First Payday families use. */
const COMMON = ["CAD", "USD", "EUR", "GBP", "MXN", "BRL", "AUD", "NZD", "CHF", "COP", "ARS", "CLP", "PEN"] as const;

/**
 * Every currency the browser/server knows that uses cents (2 decimals), so prices like $0.50 work.
 * The household currency is chosen on its own: it never follows the language.
 */
/** "₹", "$", "€"… (the code itself when a currency has no symbol of its own). */
export function currencySymbol(code: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

export function currencyOptions(locale: string): { code: string; name: string; label: string; common: boolean }[] {
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
  const opt = (code: string, common: boolean) => {
    const name = String(names.of(code));
    return { code, name, label: `${code} · ${name}`, common };
  };
  const common = COMMON.map((code) => opt(code, true));
  const rest = all
    .filter((c) => !(COMMON as readonly string[]).includes(c) && twoDecimals(c))
    .map((code) => opt(code, false))
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

export const CURRENCY_COPY: Record<string, { common: string; all: string; hint: string; search: string; none: string }> = {
  en: { common: "Most used", all: "All currencies", hint: "Any currency: it's up to you.", search: "Search: rupee, INR, ₹…", none: "No currency matches." },
  fr: { common: "Les plus utilisées", all: "Toutes les devises", hint: "N'importe quelle devise : à vous de choisir.", search: "Rechercher : roupie, INR, ₹…", none: "Aucune devise ne correspond." },
  es: { common: "Las más usadas", all: "Todas las monedas", hint: "Cualquier moneda: tú eliges.", search: "Buscar: rupia, INR, ₹…", none: "Ninguna moneda coincide." },
  pt: { common: "Mais usadas", all: "Todas as moedas", hint: "Qualquer moeda: você escolhe.", search: "Buscar: rupia, INR, ₹…", none: "Nenhuma moeda encontrada." },
};
