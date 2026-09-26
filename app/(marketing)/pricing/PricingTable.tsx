"use client";

import Link from "next/link";
import { useState } from "react";
import { FREE_KIDS, PRICE_PER_EXTRA_KID_CENTS, monthlyPriceCents } from "@/lib/billing/plans";

const FEATURES = [
  "Kids' tablet mode (iPad / Android)",
  "Unlimited chores + ready-made templates",
  "Per-unit pricing (e.g. $5 per floor)",
  "Approve / send back from any phone",
  "Balances, payouts, savings match",
  "History + CSV export",
  "Up to 5 tablets and 4 parents",
  "English & français",
];

export function PricingTable() {
  const [kids, setKids] = useState(2);
  const fmt = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  return (
    <div className="mt-10 grid items-start gap-6 md:grid-cols-2">
      <div className="rounded-3xl bg-card p-7 shadow-[var(--shadow-card)] ring-2 ring-amber">
        <h2 className="font-display text-3xl font-bold">One simple price</h2>
        <p className="mt-4 font-display text-4xl font-extrabold text-moss">First kid free</p>
        <p className="text-ink-soft">forever, every feature included</p>
        <p className="mt-4 font-display text-4xl font-extrabold text-maple">{fmt(PRICE_PER_EXTRA_KID_CENTS)}<span className="text-xl"> / extra kid / month</span></p>
        <p className="text-ink-soft">CAD, + tax · cancel any time · 14 days free to start</p>
        <ul className="my-6 flex flex-col gap-2">
          {FEATURES.map((f) => <li key={f}>✓ {f}</li>)}
        </ul>
        <Link href="/signup" className="block rounded-full bg-maple py-3 text-center font-black text-white">Start free</Link>
      </div>

      <div className="rounded-3xl bg-card/70 p-7 ring-1 ring-line">
        <h2 className="font-display text-2xl font-bold">What would I pay?</h2>
        <label className="mt-4 block font-bold" htmlFor="kids-count">How many kids?</label>
        <div className="mt-2 flex items-center gap-4">
          <button type="button" aria-label="Fewer kids" onClick={() => setKids((k) => Math.max(1, k - 1))} className="h-12 w-12 rounded-full bg-amber text-2xl font-black text-white">−</button>
          <output id="kids-count" className="w-10 text-center font-display text-4xl font-extrabold">{kids}</output>
          <button type="button" aria-label="More kids" onClick={() => setKids((k) => Math.min(10, k + 1))} className="h-12 w-12 rounded-full bg-amber text-2xl font-black text-white">+</button>
        </div>
        <p className="mt-6 font-display text-5xl font-extrabold text-maple">
          {monthlyPriceCents(kids) === 0 ? "Free" : `${fmt(monthlyPriceCents(kids))}/mo`}
        </p>
        <p className="mt-1 text-ink-soft">
          {kids <= FREE_KIDS ? "One kid is always free." : `1 free kid + ${kids - FREE_KIDS} × ${fmt(PRICE_PER_EXTRA_KID_CENTS)}`}
        </p>
      </div>
    </div>
  );
}
