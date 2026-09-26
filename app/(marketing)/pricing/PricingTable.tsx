"use client";

import Link from "next/link";
import { useState } from "react";
import { PLAN_PRICES } from "@/lib/billing/plans";

const PLANS = [
  { id: "family" as const, name: "Family", features: ["Up to 3 kids", "Unlimited chores", "2 kids' tablets", "2 parents", "Approvals, payouts, history"] },
  { id: "family_plus" as const, name: "Family Plus", features: ["Up to 8 kids", "Unlimited chores", "5 kids' tablets", "4 parents", "CSV export", "Savings match", "Custom themes"] },
];

export function PricingTable() {
  const [yearly, setYearly] = useState(true);
  const fmt = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  return (
    <>
      <div className="mt-8 flex justify-center">
        <div className="inline-flex rounded-full bg-card p-1 ring-1 ring-line" role="group" aria-label="Billing period">
          <button type="button" onClick={() => setYearly(false)} aria-pressed={!yearly} className={`min-h-11 rounded-full px-5 font-bold ${!yearly ? "bg-maple text-white" : "text-ink-soft"}`}>Monthly</button>
          <button type="button" onClick={() => setYearly(true)} aria-pressed={yearly} className={`min-h-11 rounded-full px-5 font-bold ${yearly ? "bg-maple text-white" : "text-ink-soft"}`}>
            Yearly <span className="ml-1 rounded-full bg-gold px-2 text-xs text-ink">2 months free</span>
          </button>
        </div>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {PLANS.map((p) => (
          <div key={p.id} className={`rounded-3xl bg-card p-7 shadow-[var(--shadow-card)] ring-1 ring-line ${p.id === "family_plus" ? "ring-2 ring-amber" : ""}`}>
            <h2 className="font-display text-3xl font-bold">{p.name}</h2>
            <p className="mt-3">
              <span className="font-display text-5xl font-extrabold text-maple">{fmt(yearly ? PLAN_PRICES[p.id].yearly : PLAN_PRICES[p.id].monthly)}</span>
              <span className="text-ink-soft"> CAD / {yearly ? "year" : "month"} + tax</span>
            </p>
            <ul className="my-6 flex flex-col gap-2">
              {p.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <Link href="/signup" className="block rounded-full bg-maple py-3 text-center font-black text-white">Start free trial</Link>
          </div>
        ))}
      </div>
    </>
  );
}
