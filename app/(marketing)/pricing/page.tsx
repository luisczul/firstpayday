import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { billingEnabled } from "@/lib/billing/plans";
import { authHref, localePath, marketing } from "@/lib/i18n/marketing";
import { getSiteLang, publicMetadata } from "@/lib/i18n/marketing/server";
import { SiteFooter, SiteHeader } from "../SiteChrome";
import { PricingTable } from "./PricingTable";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  const p = marketing(lang).pricing;
  return publicMetadata(lang, "/pricing", { title: p.metaTitle, description: p.metaDescription });
}

export default async function PricingPage() {
  const lang = await getSiteLang();
  // Hidden while First Payday is free (billing switched off); kept for when pricing returns.
  if (!billingEnabled()) redirect(localePath(lang, "/"));
  const m = marketing(lang);
  const p = m.pricing;
  return (
    <div className="paper-texture min-h-dvh">
      <SiteHeader lang={lang} path="/pricing" />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-center font-display text-5xl font-extrabold">{p.h1}</h1>
        <p className="mt-3 text-center text-lg text-ink-soft">{p.lead}</p>
        <PricingTable t={p.table} signupHref={authHref(lang, "/signup")} />
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-4 font-display text-3xl font-bold">{p.faqTitle}</h2>
          {p.faq.map(([q, a]) => (
            <details key={q} className="mb-3 rounded-2xl bg-card p-5 ring-1 ring-line">
              <summary className="cursor-pointer font-bold">{q}</summary>
              <p className="mt-2 text-ink-soft">{a}</p>
            </details>
          ))}
        </section>
      </main>
      <SiteFooter lang={lang} path="/pricing" />
    </div>
  );
}
