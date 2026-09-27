import { billingEnabled } from "@/lib/billing/plans";
import { GUIDE_SLUGS, marketing, type Guide, type SiteLang } from "@/lib/i18n/marketing";
// SEO landing pages: real, useful content for what parents search for, in every site language.
// Copy lives in lib/i18n/marketing/{en,fr,es,pt}.ts; slugs stay English in every language.

export type SeoPage = Guide;
export type { GuideSection as SeoSection } from "@/lib/i18n/marketing";

export { GUIDE_SLUGS };

/** The guides in a language (billing-dependent answers follow the billing switch). */
export function seoPages(lang: SiteLang = "en"): SeoPage[] {
  return marketing(lang).guides(billingEnabled());
}

/** English guides (kept for existing imports). */
export const SEO_PAGES: SeoPage[] = seoPages("en");
