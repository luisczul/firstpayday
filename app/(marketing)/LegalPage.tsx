import { brand } from "@/lib/brand";
import { intlLocale } from "@/lib/i18n";
import { fill, marketing, type LegalBlock, type SiteLang } from "@/lib/i18n/marketing";
import { Rich, SiteFooter, SiteHeader } from "./SiteChrome";

/** Date shown as "Last updated …" on both legal pages. */
const UPDATED = Date.UTC(2026, 8, 26);

export function LegalPage({ lang, path, title, blocks }: { lang: SiteLang; path: string; title: string; blocks: LegalBlock[] }) {
  const t = marketing(lang).legal;
  const updated = new Intl.DateTimeFormat(intlLocale(lang), { dateStyle: "long", timeZone: "UTC" }).format(UPDATED);
  return (
    <div className="paper-texture min-h-dvh">
      <SiteHeader lang={lang} path={path} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="mb-4 rounded-xl bg-gold/40 px-4 py-3 text-sm font-bold">{t.draft}</p>
        <h1 className="font-display text-4xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-ink-soft">{fill(t.updated, { date: updated })}</p>
        {t.controlling ? <p className="mt-3 rounded-xl bg-card px-4 py-3 text-sm text-ink-soft ring-1 ring-line">{t.controlling}</p> : null}
        <div className="mt-6 flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-6">
          {blocks.map((b, i) =>
            b.h ? (
              <h2 key={i}>{b.h}</h2>
            ) : b.ul ? (
              <ul key={i}>
                {b.ul.map((li) => <li key={li}><Rich text={li} /></li>)}
              </ul>
            ) : b.contact !== undefined ? (
              <p key={i}>
                {b.contact ? `${b.contact} ` : null}
                <a href={`mailto:${brand.supportEmail}`} className="font-bold text-maple">{brand.supportEmail}</a>
                {b.contact ? "." : null}
              </p>
            ) : (
              <p key={i}><Rich text={b.p ?? ""} /></p>
            ),
          )}
        </div>
      </main>
      <SiteFooter lang={lang} path={path} />
    </div>
  );
}

export function brandVars() {
  return { name: brand.name, entity: brand.legalEntityName, email: brand.supportEmail };
}
