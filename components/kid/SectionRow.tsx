"use client";

import type { ReactNode } from "react";

/** One horizontal, swipeable row of cards (SPEC §6 K2). */
export function SectionRow({
  title,
  count,
  tone = "default",
  children,
}: {
  title: string;
  count?: number;
  tone?: "default" | "fix" | "new";
  children: ReactNode;
}) {
  return (
    <section className="py-3">
      <h2
        className={`mb-3 flex items-center gap-3 px-8 font-display text-3xl font-bold ${
          tone === "fix" ? "text-plum" : tone === "new" ? "text-maple" : "text-ink"
        }`}
      >
        {title}
        {count ? (
          <span className="rounded-full bg-ink/10 px-3 py-0.5 font-sans text-lg font-extrabold text-ink-soft">{count}</span>
        ) : null}
      </h2>
      <div className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-8 px-8 pt-1 pb-5">
        {children}
      </div>
    </section>
  );
}
