import { SiteFooter, SiteHeader } from "../SiteChrome";
import { PricingTable } from "./PricingTable";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="paper-texture min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-center font-display text-5xl font-extrabold">Pricing</h1>
        <p className="mt-3 text-center text-lg text-ink-soft">Every plan starts with a 14-day free trial. No credit card needed.</p>
        <PricingTable />
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-4 font-display text-3xl font-bold">FAQ</h2>
          {[
            ["Can I switch plans later?", "Yes, any time from Settings → Billing. Changes are prorated."],
            ["What happens if I cancel?", "Your household stays active until the end of the period, then goes read-only. Nothing is deleted."],
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
