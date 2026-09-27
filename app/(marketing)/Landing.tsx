import Link from "next/link";
import { billingEnabled } from "@/lib/billing/plans";
import { brand } from "@/lib/brand";
import { authHref, fill, localePath, marketing, type SiteLang } from "@/lib/i18n/marketing";
import { LangSuggest } from "./LangSuggest";
import { JsonLd, faqFor, landingJsonLd } from "./seo";
import { Rich, SiteFooter, SiteHeader } from "./SiteChrome";
import { WhyItMatters } from "./WhyItMatters";

// Kid-sized demo prices (the owner's rule: $1–$2 examples, never adult-sized amounts).
const DEMO_CARDS = [
  { emoji: "🧽", amount: 2, perFloor: true, color: "#B8431F" },
  { emoji: "🚗", amount: 2, perFloor: false, color: "#E08A1E" },
  { emoji: "🍖", amount: 2, perFloor: false, color: "#7A3B4A" },
  { emoji: "🧺", amount: 1, perFloor: false, color: "#6B7A2E" },
];

// What the English home page may offer a visitor whose browser prefers another language.
const SUGGESTIONS = (["fr", "es", "pt"] as const).map((l) => ({ lang: l, href: localePath(l, "/"), ...marketing(l).suggest }));

function TabletMockup({ lang }: { lang: SiteLang }) {
  const m = marketing(lang);
  return (
    <div className="relative mx-auto w-full max-w-2xl rounded-[2.2rem] bg-ink p-3 shadow-[var(--shadow-pop)]" aria-label={m.hero.tabletLabel}>
      <div className="paper-texture overflow-hidden rounded-[1.6rem] p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber font-display text-2xl font-bold text-white ring-4 ring-card">M</span>
          <span className="font-display text-3xl font-bold text-ink">Mateo</span>
          <span className="ml-auto rounded-2xl bg-card px-4 py-1.5 text-right shadow-[var(--shadow-card)]">
            <span className="block font-display text-2xl font-bold text-moss">{m.money(14.5)}</span>
            <span className="block text-xs font-bold text-amber">{fill(m.hero.waiting, { amount: m.money(3) })}</span>
          </span>
        </div>
        <p className="mb-2 font-display text-xl font-bold text-maple">{m.hero.newRow}</p>
        <div className="grid grid-cols-2 gap-3">
          {DEMO_CARDS.map((c, i) => (
            <div key={c.emoji} className="relative h-40 overflow-hidden rounded-2xl bg-card p-3 pl-5 shadow-[var(--shadow-card)] ring-1 ring-line">
              <span className="absolute inset-y-0 left-0 w-2" style={{ background: c.color }} />
              <span className="absolute top-2 right-2 rounded-full bg-gold px-2 py-0.5 text-xs font-black">
                {m.money(c.amount)}{c.perFloor ? ` ${m.hero.perFloor}` : ""}
              </span>
              <span className="mt-6 block text-3xl">{c.emoji}</span>
              <span className="mt-1 block font-display text-base leading-tight font-bold">{m.hero.cards[i]}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-center">
          <span className="rounded-2xl bg-moss px-6 py-2.5 text-lg font-black text-white shadow-[0_4px_0_#4a5620]">{m.hero.didIt}</span>
        </div>
      </div>
    </div>
  );
}

export function Landing({ lang = "en" }: { lang?: SiteLang }) {
  const m = marketing(lang);
  const billing = billingEnabled();
  const signup = authHref(lang, "/signup");
  return (
    <div className="paper-texture min-h-dvh">
      <JsonLd data={landingJsonLd(lang)} />
      {lang === "en" ? <LangSuggest offers={SUGGESTIONS} /> : null}
      <SiteHeader lang={lang} path="/" />
      <main className="mx-auto max-w-6xl px-4">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-2 lg:py-16 [&>*]:min-w-0">
          <div>
            <h1 className="font-display text-5xl leading-[1.05] font-extrabold text-ink md:text-6xl">
              {m.hero.h1Start} <span className="text-maple">{m.hero.h1Accent}</span>
            </h1>
            <p className="mt-5 text-xl text-ink-soft">{m.hero.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={signup} className="rounded-full bg-maple px-7 py-4 text-lg font-black text-white shadow-[0_4px_0_#8a3217]">{m.nav.startFree}</Link>
              {billing ? (
                <Link href={localePath(lang, "/pricing")} className="rounded-full bg-card px-7 py-4 text-lg font-black text-ink ring-1 ring-line">{m.hero.seePricing}</Link>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-ink-soft">{billing ? m.hero.notePaid : m.hero.noteFree}</p>
          </div>
          <TabletMockup lang={lang} />
        </section>

        <WhyItMatters lang={lang} />

        <section className="py-12">
          <h2 className="text-center font-display text-4xl font-bold">{m.how.title}</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {m.how.steps.map(([emoji, title, body], i) => (
              <div key={title} className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-line">
                <span className="text-4xl">{emoji}</span>
                <p className="mt-3 text-sm font-black text-amber">{m.how.step} {i + 1}</p>
                <h3 className="font-display text-2xl font-bold">{title}</h3>
                <p className="mt-2 text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 py-12 md:grid-cols-2 lg:grid-cols-3">
          {m.features.map(([emoji, title, body]) => (
            <div key={title} className="rounded-3xl bg-card/70 p-6 ring-1 ring-line">
              <span className="text-3xl">{emoji}</span>
              <h3 className="mt-2 font-display text-xl font-bold">{title}</h3>
              <p className="mt-1 text-ink-soft">{body}</p>
            </div>
          ))}
        </section>

        {billing ? (
          <section className="py-12 text-center">
            <h2 className="font-display text-4xl font-bold">{m.paidSection.title}</h2>
            <p className="mt-3 text-lg text-ink-soft"><Rich text={m.paidSection.body} /></p>
            <Link href={localePath(lang, "/pricing")} className="mt-5 inline-block font-black text-maple underline">{m.paidSection.cta}</Link>
          </section>
        ) : (
          <section className="py-12 text-center">
            <h2 className="font-display text-4xl font-bold">{m.freeSection.title}</h2>
            <p className="mt-3 text-lg text-ink-soft"><Rich text={m.freeSection.body} /></p>
            <Link href={signup} className="mt-5 inline-block font-black text-maple underline">{m.freeSection.cta}</Link>
          </section>
        )}

        <section className="mx-auto max-w-3xl py-12">
          <h2 className="mb-6 text-center font-display text-4xl font-bold">{m.faqTitle}</h2>
          <div className="flex flex-col gap-3">
            {faqFor(lang).map(([q, a]) => (
              <details key={q} className="rounded-2xl bg-card p-5 ring-1 ring-line">
                <summary className="cursor-pointer font-bold">{q}</summary>
                <p className="mt-2 text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="my-10 rounded-[2rem] bg-maple px-6 py-12 text-center text-white">
          <h2 className="font-display text-4xl font-bold">{m.closing.title}</h2>
          <Link href={signup} className="mt-6 inline-block rounded-full bg-gold px-8 py-4 text-lg font-black text-ink">{m.nav.startFree}</Link>
          <p className="mt-3 text-sm text-white/80">{brand.name} · {billing ? m.closing.tagPaid : m.closing.tagFree}</p>
        </section>
      </main>
      <SiteFooter lang={lang} path="/" />
    </div>
  );
}
