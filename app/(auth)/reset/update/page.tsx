import type { Metadata } from "next";
import { marketing } from "@/lib/i18n/marketing";
import { getSiteLang } from "@/lib/i18n/marketing/server";
import { AuthShell } from "../../AuthShell";
import { authMetadata } from "../../authMeta";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  return authMetadata(lang, "/reset/update", marketing(lang).auth.newPasswordTitle);
}

export default async function UpdatePasswordPage() {
  const lang = await getSiteLang();
  const t = marketing(lang).auth;
  return (
    <AuthShell lang={lang} title={t.newPasswordTitle}>
      <UpdatePasswordForm t={{ newPassword: t.newPassword, passwordHint: t.passwordHint, savePassword: t.savePassword }} />
    </AuthShell>
  );
}
