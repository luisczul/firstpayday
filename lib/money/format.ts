const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, currency: string, whole: boolean): Intl.NumberFormat {
  const key = `${locale}|${currency}|${whole}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : locale === "en" ? "en-CA" : locale, {
      style: "currency",
      currency,
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
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith("-");
  const [whole, frac = ""] = cleaned.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -cents : cents;
}
