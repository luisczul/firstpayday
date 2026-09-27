import { InstallApp } from "@/components/InstallApp";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { brand } from "@/lib/brand";
import { billingEnabled } from "@/lib/billing/plans";
import { LOCALE_NAMES } from "@/lib/i18n";
import { SITE_LANGS, authHref, localePath, marketing, type SiteLang } from "@/lib/i18n/marketing";

/** Renders **bold** segments of a dictionary string. */
export function Rich({ text }: { text: string }): ReactNode {
  return text.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>));
}

// Language links are plain <a> (full page load): the root layout, which sets <html lang>,
// is not re-rendered on client-side navigation.

/** Compact header switcher: "🌐 FR" opening the four languages (no JavaScript needed). */
function LanguageMenu({ lang, path }: { lang: SiteLang; path: string }) {
  return (
    <details className="relative">
      <summary
        aria-label={marketing(lang).nav.language}
        className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-2.5 py-2 text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden>🌐</span>
        {/* Just the globe on the smallest phones, so the header never gets cut off. */}
        <span className="hidden min-[400px]:inline">{lang.toUpperCase()}</span>
      </summary>
      <ul className="absolute right-0 z-20 mt-1 flex min-w-36 flex-col rounded-xl bg-card p-1 shadow-[var(--shadow-pop)] ring-1 ring-line">
        {SITE_LANGS.map((l) => (
          <li key={l}>
            <a
              href={localePath(l, path)}
              hrefLang={l}
              lang={l}
              aria-current={l === lang ? "true" : undefined}
              className={`block rounded-lg px-3 py-2 ${l === lang ? "bg-paper-deep/60 text-ink" : "text-ink-soft hover:text-ink"}`}
            >
              {LOCALE_NAMES[l]}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SiteHeader({ lang = "en", path = "/" }: { lang?: SiteLang; path?: string }) {
  const t = marketing(lang).nav;
  return (
    <header className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-5 sm:gap-4">
      <Link href={localePath(lang, "/")} className="flex shrink-0 items-center gap-2 font-display text-xl font-bold text-maple">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-maple text-lg text-gold">$</span>
        <span className="hidden truncate min-[400px]:inline">{brand.name}</span>
      </Link>
      <nav className="ml-auto flex min-w-0 items-center gap-0.5 text-sm font-bold sm:gap-1">
        <InstallApp lang={lang} compact />
        <LanguageMenu lang={lang} path={path} />
        {billingEnabled() ? <Link href={localePath(lang, "/pricing")} className="hidden rounded-lg px-3 py-2 text-ink-soft hover:text-ink sm:block">{t.pricing}</Link> : null}
        <Link href={authHref(lang, "/login")} className="rounded-lg px-2 py-2 whitespace-nowrap text-ink-soft hover:text-ink sm:px-3">{t.login}</Link>
        <Link href={authHref(lang, "/signup")} className="rounded-full bg-maple px-4 py-2 whitespace-nowrap text-white">
          <span className="sm:hidden">{t.startShort}</span>
          <span className="hidden sm:inline">{t.startFree}</span>
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter({ lang = "en", path = "/" }: { lang?: SiteLang; path?: string }) {
  const t = marketing(lang).footer;
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 pt-8 pb-4 text-sm text-ink-soft">
        <span>© {new Date().getFullYear()} {brand.legalEntityName}</span>
        <a href={`mailto:${brand.supportEmail}`} className="hover:text-ink">{brand.supportEmail}</a>
        <span className="ml-auto flex flex-wrap gap-4">
          <Link href={localePath(lang, "/chore-chart-app")} className="hover:text-ink">{t.choreChart}</Link>
          <Link href={localePath(lang, "/allowance-app-for-kids")} className="hover:text-ink">{t.allowance}</Link>
          <Link href={localePath(lang, "/paid-chores-list")} className="hover:text-ink">{t.paidChores}</Link>
          <Link href={localePath(lang, "/terms")} className="hover:text-ink">{t.terms}</Link>
          <Link href={localePath(lang, "/privacy")} className="hover:text-ink">{t.privacy}</Link>
        </span>
      </div>
      <nav aria-label={t.languages} className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-8 text-sm text-ink-soft">
        <span aria-hidden>🌐</span>
        {SITE_LANGS.map((l, i) => (
          <Fragment key={l}>
            {i > 0 ? <span aria-hidden>·</span> : null}
            <a
              href={localePath(l, path)}
              hrefLang={l}
              lang={l}
              aria-current={l === lang ? "true" : undefined}
              className={l === lang ? "font-black text-ink" : "hover:text-ink"}
            >
              {LOCALE_NAMES[l]}
            </a>
          </Fragment>
        ))}
      </nav>
    </footer>
  );
}
