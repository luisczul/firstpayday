import Link from "next/link";
import { brand } from "@/lib/brand";

export function Landing() {
  return (
    <main className="paper-texture flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="font-display text-5xl font-extrabold text-ink">{brand.name}</h1>
      <p className="text-xl text-ink-soft">{brand.tagline}</p>
      <div className="flex gap-3">
        <Link href="/signup" className="rounded-full bg-maple px-6 py-3 font-black text-white">Start free trial</Link>
        <Link href="/login" className="rounded-full bg-card px-6 py-3 font-black text-ink ring-1 ring-line">Log in</Link>
      </div>
    </main>
  );
}
