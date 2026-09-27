import type { Metadata } from "next";
import Link from "next/link";
import { authHref, marketing } from "@/lib/i18n/marketing";
import { getSiteLang } from "@/lib/i18n/marketing/server";
import { AuthShell } from "../AuthShell";
import { authMetadata } from "../authMeta";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  return authMetadata(lang, "/login", marketing(lang).auth.loginMeta);
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const lang = await getSiteLang();
  const t = marketing(lang).auth;
  return (
    <AuthShell
      lang={lang}
      path="/login"
      title={t.loginTitle}
      footer={
        <>
          {t.newHere} <Link href={authHref(lang, "/signup")} className="font-bold text-maple">{t.createFreeLink}</Link>
        </>
      }
    >
      <LoginForm
        next={next ?? "/admin"}
        linkError={error === "link"}
        resetHref={authHref(lang, "/reset")}
        t={{ email: t.email, password: t.password, loggingIn: t.loggingIn, loginButton: t.loginButton, magicLink: t.magicLink, forgot: t.forgot, linkExpired: t.linkExpired }}
      />
    </AuthShell>
  );
}
