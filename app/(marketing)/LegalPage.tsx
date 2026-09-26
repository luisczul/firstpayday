import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="paper-texture min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="mb-4 rounded-xl bg-gold/40 px-4 py-3 text-sm font-bold">
          DRAFT: placeholder text to be reviewed by a lawyer before launch.
        </p>
        <h1 className="font-display text-4xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-ink-soft">Last updated {updated}</p>
        <div className="mt-6 flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
