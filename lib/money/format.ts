const formatters = new Map<string, Intl.NumberFormat>();

/** App locale -> Intl tag (kept inline so this module stays dictionary-free). */
const INTL: Record<string, string> = { en: "en-CA", fr: "fr-CA", es: "es-419", pt: "pt-BR" };
const NARROW = new Set(["es", "pt"]);

function formatter(locale: string, currency: string, whole: boolean): Intl.NumberFormat {
  const key = `${locale}|${currency}|${whole}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(INTL[locale] ?? locale, {
      style: "currency",
      currency,
      // Spanish/Portuguese Intl data spells out "CAD"/"MXN"; kids read "$".
      currencyDisplay: NARROW.has(locale) ? "narrowSymbol" : "symbol",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, f);
  }
  return f;
}

/** "$42.00" (or "42,00 $" in French). */
export function formatMoney(cents: number, currency = "CAD", locale = "en"): string {
  return formatter(locale, currency, false).format(cents / 100);
}

/** Price chip style: "$5" for whole amounts, "$4.50" otherwise. */
export function formatPrice(cents: number, currency = "CAD", locale = "en"): string {
  return formatter(locale, currency, cents % 100 === 0).format(cents / 100);
}

/** Parse a parent-typed amount ("12", "12.5", "12,50", "$12") to cents. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[\s$€£]/g, "").replace(",", ".");
  // "12", "12.5", "0.50" and ".50" (50 cents).
  if (!/^-?(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(cleaned)) return null;
  const negative = cleaned.startsWith("-");
  const [whole, frac = ""] = cleaned.replace("-", "").split(".");
  const cents = Number(whole || 0) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -cents : cents;
}

/** Value for an amount text field, with the decimal comma where the language uses one: "1.10" / "1,10". */
export function amountInput(cents: number, locale = "en", trimWhole = false): string {
  let s = (cents / 100).toFixed(2);
  if (trimWhole) s = s.replace(/\.00$/, "");
  return locale === "fr" || locale === "pt" ? s.replace(".", ",") : s;
}
