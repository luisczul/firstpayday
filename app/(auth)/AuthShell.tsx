import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { brand } from "@/lib/brand";
import { LOCALE_NAMES } from "@/lib/i18n";
import { SITE_LANGS, authHref, localePath, marketing, type SiteLang } from "@/lib/i18n/marketing";

export function AuthShell({
  title,
  children,
  footer,
  aside,
  lang = "en",
  path,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
  lang?: SiteLang;
  /** Auth path ("/signup", "/login"…): when set, shows the four-language switcher for it. */
  path?: string;
}) {
  return (
    <main className="paper-texture flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href={localePath(lang, "/")} className="mb-6 flex items-center justify-center gap-2 font-display text-2xl font-bold text-maple">
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-maple text-xl text-gold">$</span>
          {brand.name}
        </Link>
        <div className="rounded-3xl bg-card p-7 shadow-[var(--shadow-pop)] ring-1 ring-line">
          <h1 className="mb-5 font-display text-3xl font-bold text-ink">{title}</h1>
          {children}
        </div>
        {footer ? <div className="mt-5 text-center text-sm text-ink-soft">{footer}</div> : null}
        {aside}
        {path ? (
          <nav aria-label={marketing(lang).nav.language} className="mt-6 flex flex-wrap justify-center gap-x-2 text-sm text-ink-soft">
            {SITE_LANGS.map((l, i) => (
              <Fragment key={l}>
                {i > 0 ? <span aria-hidden>·</span> : null}
                <a href={authHref(l, path)} hrefLang={l} lang={l} className={l === lang ? "font-black text-ink" : "hover:text-ink"}>
                  {LOCALE_NAMES[l]}
                </a>
              </Fragment>
            ))}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
