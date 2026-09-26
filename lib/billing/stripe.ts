import "server-only";
import Stripe from "stripe";
import { requireEnv } from "@/lib/env";
import { LOOKUP_KEYS, planFromLookupKey, type Interval, type PaidPlanId } from "./plans";
import { createAdminClient } from "@/lib/supabase/admin";

let client: Stripe | null = null;

export function stripe(): Stripe {
  client ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"), { appInfo: { name: "Chore Board" } });
  return client;
}

const ENV_PRICE: Record<string, string | undefined> = {
  family_monthly: process.env.STRIPE_PRICE_FAMILY_MONTHLY,
  family_yearly: process.env.STRIPE_PRICE_FAMILY_YEARLY,
  family_plus_monthly: process.env.STRIPE_PRICE_FAMILY_PLUS_MONTHLY,
  family_plus_yearly: process.env.STRIPE_PRICE_FAMILY_PLUS_YEARLY,
};

/** Price id by lookup key (SPEC §19.2: lookup keys first, env ids as a cache/fallback). */
export async function priceIdFor(plan: PaidPlanId, interval: Interval): Promise<string> {
  const key = LOOKUP_KEYS[plan][interval];
  const { data } = await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const id = data[0]?.id ?? ENV_PRICE[key];
  if (!id) throw new Error(`No Stripe price for ${key}. Run scripts/stripe-setup.ts.`);
  return id;
}

export const automaticTax = () => process.env.STRIPE_AUTOMATIC_TAX !== "false";

function periodEnd(sub: Stripe.Subscription): number | null {
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
  return ends.length ? Math.min(...ends) : null;
}

/**
 * Pull the subscription from Stripe (never trust event order, SPEC §19.4)
 * and mirror it into public.subscriptions. Complimentary plans stay comp.
 */
export async function syncSubscription(subscriptionId: string, hintHouseholdId?: string | null): Promise<void> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
  const admin = createAdminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let householdId = sub.metadata?.household_id || hintHouseholdId || null;
  if (!householdId) {
    const { data } = await admin.from("subscriptions").select("household_id").eq("stripe_customer_id", customerId).maybeSingle();
    householdId = data?.household_id ?? null;
  }
  if (!householdId) throw new Error(`No household for subscription ${sub.id}`);

  const { data: existing } = await admin.from("subscriptions").select("*").eq("household_id", householdId).maybeSingle();
  const price = sub.items.data[0]?.price;
  const plan = planFromLookupKey(price?.lookup_key) ?? existing?.plan ?? "family";
  const status = sub.status;
  const end = periodEnd(sub);

  const { error } = await admin.from("subscriptions").upsert(
    {
      household_id: householdId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: price?.id ?? null,
      plan: existing?.plan === "comp" ? "comp" : plan,
      status,
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : (existing?.trial_ends_at ?? null),
      current_period_end: end ? new Date(end * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end || Boolean(sub.cancel_at),
      past_due_since: status === "past_due" ? (existing?.past_due_since ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id" },
  );
  if (error) throw error;
}

export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const s = invoice.parent?.subscription_details?.subscription;
  if (!s) return null;
  return typeof s === "string" ? s : s.id;
}
