import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/lib/brand";

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="paper-texture flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-display text-2xl font-bold text-maple">
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-maple text-xl text-gold">$</span>
          {brand.name}
        </Link>
        <div className="rounded-3xl bg-card p-7 shadow-[var(--shadow-pop)] ring-1 ring-line">
          <h1 className="mb-5 font-display text-3xl font-bold text-ink">{title}</h1>
          {children}
        </div>
        {footer ? <div className="mt-5 text-center text-sm text-ink-soft">{footer}</div> : null}
      </div>
    </main>
  );
}
