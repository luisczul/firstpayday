import type { Metadata } from "next";
import { billingEnabled } from "@/lib/billing/plans";
import { marketing } from "@/lib/i18n/marketing";
import { getSiteLang, publicMetadata } from "@/lib/i18n/marketing/server";
import { LegalPage, brandVars } from "../LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  const m = marketing(lang);
  return publicMetadata(lang, "/delete-account", { title: m.legal.deleteTitle, description: m.meta.siteDescription });
}

export default async function DeleteAccountPage() {
  const lang = await getSiteLang();
  const t = marketing(lang).legal;
  return <LegalPage lang={lang} path="/delete-account" title={t.deleteTitle} blocks={t.deleteAccount(brandVars(), billingEnabled())} />;
}
