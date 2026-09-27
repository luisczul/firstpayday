import type { Metadata } from "next";
import Link from "next/link";
import { billingEnabled } from "@/lib/billing/plans";
import { authHref, localePath, marketing } from "@/lib/i18n/marketing";
import { getSiteLang } from "@/lib/i18n/marketing/server";
import { AuthShell } from "../AuthShell";
import { authMetadata } from "../authMeta";
import { SignupForm } from "./SignupForm";
import { WhyItMatters } from "@/app/(marketing)/WhyItMatters";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  return authMetadata(lang, "/signup", marketing(lang).auth.signupMeta);
}

// ?lang=fr|es|pt localizes the page (middleware also remembers it for onboarding's default language).
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const lang = await getSiteLang();
  const t = marketing(lang).auth;
  return (
    <AuthShell
      lang={lang}
      path="/signup"
      title={t.signupTitle}
      aside={<WhyItMatters compact lang={lang} />}
      footer={
        <>
          {t.haveAccount} <Link href={authHref(lang, "/login")} className="font-bold text-maple">{t.loginLink}</Link>
        </>
      }
    >
      <p className="-mt-2 mb-5 text-ink-soft">{billingEnabled() ? t.signupLeadPaid : t.signupLeadFree}</p>
      <SignupForm
        next={next}
        termsHref={localePath(lang, "/terms")}
        privacyHref={localePath(lang, "/privacy")}
        t={{
          email: t.email,
          password: t.password,
          passwordHint: t.passwordHint,
          acceptBefore: t.acceptBefore,
          termsLink: t.termsLink,
          and: t.and,
          privacyLink: t.privacyLink,
          acceptAfter: t.acceptAfter,
          creating: t.creating,
          createButton: t.createButton,
        }}
      />
    </AuthShell>
  );
}
