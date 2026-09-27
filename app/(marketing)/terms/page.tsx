import type { Metadata } from "next";
import { billingEnabled } from "@/lib/billing/plans";
import { marketing } from "@/lib/i18n/marketing";
import { getSiteLang, publicMetadata } from "@/lib/i18n/marketing/server";
import { LegalPage, brandVars } from "../LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  const m = marketing(lang);
  return publicMetadata(lang, "/terms", { title: m.legal.termsTitle, description: m.meta.siteDescription });
}

export default async function TermsPage() {
  const lang = await getSiteLang();
  const t = marketing(lang).legal;
  return <LegalPage lang={lang} path="/terms" title={t.termsTitle} blocks={t.terms(brandVars(), billingEnabled())} />;
}
