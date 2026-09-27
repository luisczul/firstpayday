import type { SiteLang } from "./routes";
import type { MarketingDict } from "./types";
import { en } from "./en";
import { fr } from "./fr";
import { es } from "./es";
import { pt } from "./pt";

export * from "./routes";
export type { MarketingDict, Guide, GuideSection, LegalBlock, BrandVars } from "./types";

const DICTS: Record<SiteLang, MarketingDict> = { en, fr, es, pt };

/** Public-site copy for a language. */
export function marketing(lang: SiteLang): MarketingDict {
  return DICTS[lang] ?? en;
}

/** Tiny template fill: fill("{amount} waiting", { amount: "$3" }). */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
