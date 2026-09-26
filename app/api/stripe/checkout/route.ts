import { NextResponse, type NextRequest } from "next/server";
import { getParentContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { automaticTax, extraKidPriceId, stripe } from "@/lib/billing/stripe";
import { billableExtraKids } from "@/lib/billing/plans";
import { appUrl } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Owner starts the subscription for extra kids ($5/month each) → Stripe
 * Checkout. Access changes only via the webhook.
 */
export async function POST(req: NextRequest) {
  const ctx = await getParentContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!ctx.isOwner) return NextResponse.json({ error: "Only the owner can manage billing." }, { status: 403 });

  const s = stripe();
  const admin = createAdminClient();
  const sub = ctx.subscription;

  // Already subscribed: manage it in the Customer Portal.
  if (sub?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(sub.status)) {
    const portal = await s.billingPortal.sessions.create({
      customer: sub.stripe_customer_id!,
      return_url: `${appUrl()}/admin/settings/billing`,
    });
    return NextResponse.redirect(portal.url, 303);
  }

  let customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await s.customers.create({
      email: ctx.user.email,
      name: ctx.household.name,
      metadata: { household_id: ctx.household.id },
    });
    customerId = customer.id;
    await admin.from("subscriptions").update({ stripe_customer_id: customerId }).eq("household_id", ctx.household.id);
  }

  // Keep the remaining free days when subscribing mid-trial (Stripe needs ≥48h).
  const trialEnd = sub?.plan === "trial" && sub.trial_ends_at ? Math.floor(new Date(sub.trial_ends_at).getTime() / 1000) : null;
  const keepTrial = trialEnd && trialEnd > Date.now() / 1000 + 48 * 3600 ? trialEnd : undefined;

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: ctx.household.id,
    line_items: [
      {
        price: await extraKidPriceId(),
        quantity: billableExtraKids(ctx.activeKids),
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 9 },
      },
    ],
    subscription_data: { metadata: { household_id: ctx.household.id }, ...(keepTrial ? { trial_end: keepTrial } : {}) },
    allow_promotion_codes: true,
    automatic_tax: { enabled: automaticTax() },
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
    success_url: `${appUrl()}/admin/settings/billing?success=1`,
    cancel_url: `${appUrl()}/admin/settings/billing?canceled=1`,
  });
  return NextResponse.redirect(session.url!, 303);
}
