/**
 * Idempotent Stripe setup. Creates (or finds) the "extra kid" product and its
 * $5 CAD/month price (lookup key extra_kid_monthly, tax exclusive).
 *
 *   STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe-setup.ts
 *
 * Run once in test mode, and again with the live key when going live.
 */
import Stripe from "stripe";
import { loadEnv } from "./load-env";
import { EXTRA_KID_LOOKUP_KEY, PRICE_PER_EXTRA_KID_CENTS } from "../lib/billing/plans";

loadEnv();
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first.");
  process.exit(1);
}
const stripe = new Stripe(key);

async function main() {
  console.log(`Stripe mode: ${key!.startsWith("sk_live_") ? "LIVE" : "TEST"}\n`);
  const existing = await stripe.prices.list({ lookup_keys: [EXTRA_KID_LOOKUP_KEY], limit: 1 });
  let priceId = existing.data[0]?.id;
  if (!priceId) {
    const found = await stripe.products.search({ query: "metadata['plan']:'extra_kid'" });
    const product =
      found.data[0] ??
      (await stripe.products.create({
        name: "Chore Board: extra kid",
        description: "First kid is free. Each additional kid on the chore board.",
        metadata: { plan: "extra_kid" },
        tax_code: "txcd_10103001",
      }));
    const price = await stripe.prices.create({
      product: product.id,
      currency: "cad",
      unit_amount: PRICE_PER_EXTRA_KID_CENTS,
      recurring: { interval: "month" },
      tax_behavior: "exclusive",
      lookup_key: EXTRA_KID_LOOKUP_KEY,
    });
    priceId = price.id;
  }
  console.log(`STRIPE_PRICE_EXTRA_KID_MONTHLY=${priceId}`);
  console.log(`
Dashboard checklist:
  [ ] Stripe Tax on, registrations for GST/HST and QST (or set STRIPE_AUTOMATIC_TAX=false)
  [ ] Customer Portal: allow quantity changes, card updates, invoice history, cancel at period end
  [ ] Webhook → https://kids.diegoczul.com/api/stripe/webhook
      events: checkout.session.completed, customer.subscription.created/updated/deleted,
      invoice.paid, invoice.payment_failed`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
