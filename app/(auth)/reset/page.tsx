import type { Metadata } from "next";
import { marketing } from "@/lib/i18n/marketing";
import { getSiteLang } from "@/lib/i18n/marketing/server";
import { AuthShell } from "../AuthShell";
import { authMetadata } from "../authMeta";
import { ResetForm } from "./ResetForm";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  return authMetadata(lang, "/reset", marketing(lang).auth.resetTitle);
}

export default async function ResetPage() {
  const lang = await getSiteLang();
  const t = marketing(lang).auth;
  return (
    <AuthShell lang={lang} path="/reset" title={t.resetTitle}>
      <ResetForm t={{ email: t.email, resetButton: t.resetButton }} />
    </AuthShell>
  );
}
