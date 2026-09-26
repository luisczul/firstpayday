/**
 * Idempotent Stripe setup (SPEC §19.2). Creates or finds the two products and
 * four prices by lookup_key, then prints the price ids for your env vars.
 *
 *   STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe-setup.ts
 *
 * Run once in test mode, and again with the live key when going live.
 */
import Stripe from "stripe";
import { loadEnv } from "./load-env";
import { LOOKUP_KEYS, PLAN_PRICES, type Interval, type PaidPlanId } from "../lib/billing/plans";

loadEnv();
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first.");
  process.exit(1);
}
const stripe = new Stripe(key);

const PRODUCTS: Record<PaidPlanId, string> = {
  family: "Chore Board Family",
  family_plus: "Chore Board Family Plus",
};

async function product(plan: PaidPlanId): Promise<string> {
  const found = await stripe.products.search({ query: `metadata['plan']:'${plan}'` });
  if (found.data[0]) return found.data[0].id;
  const p = await stripe.products.create({ name: PRODUCTS[plan], metadata: { plan }, tax_code: "txcd_10103001" });
  return p.id;
}

async function price(plan: PaidPlanId, interval: Interval, productId: string): Promise<string> {
  const lookup_key = LOOKUP_KEYS[plan][interval];
  const existing = await stripe.prices.list({ lookup_keys: [lookup_key], limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const p = await stripe.prices.create({
    product: productId,
    currency: "cad",
    unit_amount: PLAN_PRICES[plan][interval],
    recurring: { interval: interval === "monthly" ? "month" : "year" },
    tax_behavior: "exclusive",
    lookup_key,
  });
  return p.id;
}

async function main() {
  const mode = key!.startsWith("sk_live_") ? "LIVE" : "TEST";
  console.log(`Stripe mode: ${mode}\n`);
  const out: Record<string, string> = {};
  for (const plan of ["family", "family_plus"] as const) {
    const productId = await product(plan);
    for (const interval of ["monthly", "yearly"] as const) {
      out[`STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`] = await price(plan, interval, productId);
    }
  }
  console.log("Paste into .env.local / Vercel:\n");
  for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
  console.log(`
Dashboard checklist:
  [ ] Stripe Tax on, registrations for GST/HST and QST (Quebec)
  [ ] Customer Portal: plan switching Family <-> Family Plus (monthly/yearly),
      card updates, invoice history, cancel at period end
  [ ] Branding: logo + Fall colors (#B8431F, #F2C14E)
  [ ] Webhook endpoint → https://kids.diegoczul.com/api/stripe/webhook
      events: checkout.session.completed, customer.subscription.created,
      customer.subscription.updated, customer.subscription.deleted,
      invoice.paid, invoice.payment_failed
  [ ] Local testing: stripe listen --forward-to localhost:3000/api/stripe/webhook`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
