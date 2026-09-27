import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDE_SLUGS, authHref, localePath, marketing } from "@/lib/i18n/marketing";
import { getSiteLang, publicMetadata } from "@/lib/i18n/marketing/server";
import { seoPages } from "../guides/pages";
import { SiteFooter, SiteHeader } from "../SiteChrome";
import { JsonLd, faqJsonLd } from "../seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_SLUGS.map((guide) => ({ guide }));
}

export async function generateMetadata({ params }: { params: Promise<{ guide: string }> }): Promise<Metadata> {
  const { guide } = await params;
  const lang = await getSiteLang();
  const page = seoPages(lang).find((p) => p.slug === guide);
  if (!page) return {};
  return publicMetadata(lang, `/${page.slug}`, { title: page.title, description: page.description });
}

export default async function GuidePage({ params }: { params: Promise<{ guide: string }> }) {
  const { guide } = await params;
  const lang = await getSiteLang();
  const m = marketing(lang);
  const pages = seoPages(lang);
  const page = pages.find((p) => p.slug === guide);
  if (!page) notFound();
  const others = pages.filter((p) => p.slug !== page.slug);
  const path = `/${page.slug}`;
  return (
    <div className="paper-texture min-h-dvh">
      <JsonLd data={{ "@context": "https://schema.org", ...faqJsonLd(lang, page.faq) }} />
      <SiteHeader lang={lang} path={path} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <article>
          <h1 className="font-display text-5xl leading-tight font-extrabold text-ink">{page.h1}</h1>
          <p className="mt-5 text-xl leading-relaxed text-ink-soft">{page.intro}</p>
          {page.sections.map((s) => (
            <section key={s.heading} className="mt-10">
              <h2 className="font-display text-3xl font-bold text-ink">{s.heading}</h2>
              {s.paragraphs?.map((p) => <p key={p.slice(0, 30)} className="mt-3 text-lg leading-relaxed">{p}</p>)}
              {s.bullets ? (
                <ul className="mt-3 flex flex-col gap-2 text-lg">
                  {s.bullets.map((b) => <li key={b}>✓ {b}</li>)}
                </ul>
              ) : null}
              {s.table ? (
                <div className="mt-4 overflow-x-auto rounded-2xl bg-card ring-1 ring-line">
                  <table className="w-full text-left">
                    <thead className="bg-paper-deep/60 text-sm font-black text-ink-soft uppercase">
                      <tr>{s.table.head.map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {s.table.rows.map((r) => (
                        <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`px-4 py-2.5 ${i === 1 ? "font-black whitespace-nowrap text-moss" : ""}`}>{c}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ))}
          <section className="mt-10">
            <h2 className="font-display text-3xl font-bold">{m.guideUi.questions}</h2>
            {page.faq.map(([q, a]) => (
              <div key={q} className="mt-4">
                <h3 className="text-lg font-bold">{q}</h3>
                <p className="text-ink-soft">{a}</p>
              </div>
            ))}
          </section>
        </article>

        <div className="my-12 rounded-[2rem] bg-maple px-6 py-10 text-center text-white">
          <p className="font-display text-3xl font-bold">{m.guideUi.tryFree}</p>
          <Link href={authHref(lang, "/signup")} className="mt-5 inline-block rounded-full bg-gold px-7 py-3 font-black text-ink">{m.nav.startFree}</Link>
        </div>

        <nav aria-label={m.guideUi.moreGuides} className="flex flex-col gap-2">
          <p className="font-bold text-ink-soft">{m.guideUi.moreGuides}</p>
          {others.map((o) => (
            <Link key={o.slug} href={localePath(lang, `/${o.slug}`)} className="font-bold text-maple underline">{o.h1}</Link>
          ))}
        </nav>
      </main>
      <SiteFooter lang={lang} path={path} />
    </div>
  );
}
