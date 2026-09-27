"use client";

import type { ReactNode } from "react";

/** One section of the kid board: a heading and a vertically-flowing grid of cards. */
export function SectionRow({
  title,
  count,
  tone = "default",
  id,
  children,
}: {
  title: string;
  count?: number;
  tone?: "default" | "fix" | "new" | "muted" | "routine" | "progress";
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-48 px-6 py-3 md:px-8">
      <h2
        className={`mb-3 flex items-center gap-3 font-display text-[1.7rem] font-bold ${
          tone === "fix" || tone === "routine" ? "text-plum" : tone === "new" ? "text-maple" : tone === "progress" ? "text-amber" : tone === "muted" ? "text-ink-soft" : "text-ink"
        }`}
      >
        {title}
        {count ? (
          <span className="rounded-full bg-ink/10 px-3 py-0.5 font-sans text-lg font-extrabold text-ink-soft">{count}</span>
        ) : null}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(225px,1fr))] gap-4 pb-4">{children}</div>
    </section>
  );
}
