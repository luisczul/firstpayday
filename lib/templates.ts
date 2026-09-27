import type { Tables } from "@/lib/supabase/database.types";
import type { Locale } from "@/lib/i18n";

export type ChoreTemplate = Tables<"chore_templates">;

export const CATEGORIES = ["car_garage", "outdoor", "kitchen", "cleaning", "laundry", "organizing", "other"] as const;
export type ChoreCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, Record<Locale, string> & { emoji: string }> = {
  car_garage: { en: "Car & Garage", fr: "Auto et garage", es: "Auto y garaje", pt: "Carro e garagem", emoji: "🚗" },
  outdoor: { en: "Outdoor", fr: "Extérieur", es: "Exterior", pt: "Área externa", emoji: "🌳" },
  kitchen: { en: "Kitchen", fr: "Cuisine", es: "Cocina", pt: "Cozinha", emoji: "🍳" },
  cleaning: { en: "Cleaning", fr: "Ménage", es: "Limpieza", pt: "Limpeza", emoji: "🧽" },
  laundry: { en: "Laundry", fr: "Lavage", es: "Ropa", pt: "Roupas", emoji: "🧺" },
  organizing: { en: "Organizing", fr: "Rangement", es: "Organización", pt: "Organização", emoji: "📦" },
  other: { en: "Other", fr: "Autres", es: "Otras", pt: "Outras", emoji: "⭐" },
};

/** Seasonal window for a template's season in a given year (month/day inclusive). */
const SEASONS: Record<string, { from: [number, number]; until: [number, number] }> = {
  fall: { from: [9, 1], until: [11, 30] },
  winter: { from: [12, 1], until: [3, 15] },
  spring: { from: [3, 15], until: [5, 31] },
  summer: { from: [6, 1], until: [8, 31] },
};

const iso = (y: number, [m, d]: [number, number]) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** The current or next occurrence of a season, as available_from/until dates. */
export function seasonWindow(season: string | null, today: Date): { available_from: string | null; available_until: string | null } {
  const s = season ? SEASONS[season] : undefined;
  if (!s) return { available_from: null, available_until: null };
  const y = today.getFullYear();
  const wraps = s.until[0] < s.from[0];
  for (const startYear of [y - 1, y, y + 1]) {
    const from = iso(startYear, s.from);
    const until = iso(wraps ? startYear + 1 : startYear, s.until);
    const todayIso = today.toISOString().slice(0, 10);
    if (todayIso <= until) return { available_from: from, available_until: until };
  }
  return { available_from: null, available_until: null };
}

export const REPEAT_PRESETS = [3, 7, 14, 30, 60, 90, 182, 365] as const;

/** Long intervals get a name instead of a day count ("Twice a year" = every 182 days). */
export const NAMED_INTERVALS: Record<number, Record<"en" | "fr" | "es" | "pt", string>> = {
  182: { en: "Twice a year", fr: "Deux fois par année", es: "Dos veces al año", pt: "Duas vezes por ano" },
  365: { en: "Yearly", fr: "Une fois par année", es: "Una vez al año", pt: "Uma vez por ano" },
};
