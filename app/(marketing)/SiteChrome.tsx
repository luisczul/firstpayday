import Link from "next/link";
import { brand } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5">
      <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-maple">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-maple text-lg text-gold">$</span>
        {brand.name}
      </Link>
      <nav className="ml-auto flex items-center gap-1 text-sm font-bold">
        <Link href="/pricing" className="rounded-lg px-3 py-2 text-ink-soft hover:text-ink">Pricing</Link>
        <Link href="/login" className="rounded-lg px-3 py-2 text-ink-soft hover:text-ink">Log in</Link>
        <Link href="/signup" className="rounded-full bg-maple px-4 py-2 text-white">Start free</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-8 text-sm text-ink-soft">
        <span>© {new Date().getFullYear()} {brand.legalEntityName}</span>
        <a href={`mailto:${brand.supportEmail}`} className="hover:text-ink">{brand.supportEmail}</a>
        <span className="ml-auto flex flex-wrap gap-4">
          <Link href="/chore-chart-app" className="hover:text-ink">Chore chart app</Link>
          <Link href="/allowance-app-for-kids" className="hover:text-ink">Allowance app</Link>
          <Link href="/paid-chores-list" className="hover:text-ink">Paid chores list</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </span>
      </div>
    </footer>
  );
}
