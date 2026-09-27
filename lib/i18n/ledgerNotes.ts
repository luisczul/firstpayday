import type { Locale } from "./index";

/**
 * Ledger notes written by database functions are stored in English
 * ("Needs a revision: Garbage boss", "Family tax 10%", "Bonus: …", "Promotion: …").
 * Show them in the reader's language. Notes typed by a parent pass through unchanged.
 */
const PREFIXES: { en: string; tr: Record<Locale, string> }[] = [
  { en: "Needs a revision: ", tr: { en: "Needs a revision: ", fr: "À corriger : ", es: "Hay que arreglar: ", pt: "Precisa arrumar: " } },
  { en: "Approval reversed: ", tr: { en: "Approval reversed: ", fr: "Approbation annulée : ", es: "Aprobación anulada: ", pt: "Aprovação desfeita: " } },
  { en: "Bonus: ", tr: { en: "Bonus: ", fr: "Bonus : ", es: "Bono: ", pt: "Bônus: " } },
  { en: "Promotion: ", tr: { en: "Promotion: ", fr: "Promotion : ", es: "Promoción: ", pt: "Promoção: " } },
];

const FAMILY_TAX: Record<Locale, (pct: string) => string> = {
  en: (p) => `Family tax ${p}%`,
  fr: (p) => `Taxe familiale ${p} %`,
  es: (p) => `Impuesto familiar ${p} %`,
  pt: (p) => `Imposto da família ${p}%`,
};

export function localizeLedgerNote(note: string | null | undefined, locale: Locale): string | null {
  if (!note) return note ?? null;
  for (const p of PREFIXES) if (note.startsWith(p.en)) return p.tr[locale] + note.slice(p.en.length);
  const tax = /^Family tax (\d+(?:\.\d+)?)%$/.exec(note);
  if (tax) return FAMILY_TAX[locale](tax[1]!);
  return note;
}
