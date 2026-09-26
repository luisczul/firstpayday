import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../SiteChrome";
import { PricingTable } from "./PricingTable";

export const metadata: Metadata = {
  title: "Pricing: first kid free, $5 per extra kid",
  description: "Chore Board pricing: your first kid is free forever. Each additional kid is $5 CAD per month. 14-day free trial, no credit card.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="paper-texture min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-center font-display text-5xl font-extrabold">Pricing</h1>
        <p className="mt-3 text-center text-lg text-ink-soft">Your first kid is free forever. Each extra kid is $5/month.</p>
        <PricingTable />
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-4 font-display text-3xl font-bold">FAQ</h2>
          {[
            ["Is the first kid really free?", "Yes, forever, with every feature. No credit card needed."],
            ["What happens when I add a second kid?", "New families get 14 days free with any number of kids. After that, each extra kid is $5/month. Adding or archiving a kid updates your subscription automatically (prorated)."],
            ["What if I stop paying?", "Nothing is deleted. The board goes read-only until you subscribe again or archive down to one kid."],
            ["Are taxes included?", "Prices are in CAD. GST/HST/QST is added at checkout based on your province."],
            ["Do you offer discounts?", "Promotion codes can be entered at checkout."],
          ].map(([q, a]) => (
            <details key={q} className="mb-3 rounded-2xl bg-card p-5 ring-1 ring-line">
              <summary className="cursor-pointer font-bold">{q}</summary>
              <p className="mt-2 text-ink-soft">{a}</p>
            </details>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
