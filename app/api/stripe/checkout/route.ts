import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getParentContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { automaticTax, priceIdFor, stripe } from "@/lib/billing/stripe";
import { appUrl } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({ plan: z.enum(["family", "family_plus"]), interval: z.enum(["monthly", "yearly"]) });

/** Owner picks a plan → Stripe Checkout (SPEC §19.3). Access changes only via the webhook. */
export async function POST(req: NextRequest) {
  const ctx = await getParentContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!ctx.isOwner) return NextResponse.json({ error: "Only the owner can manage billing." }, { status: 403 });

  const form = await req.formData();
  const parsed = Body.safeParse({ plan: form.get("plan"), interval: form.get("interval") });
  if (!parsed.success) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  const s = stripe();
  const admin = createAdminClient();
  const sub = ctx.subscription;

  // Already subscribed: plan changes happen in the Customer Portal.
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

  // Keep the remaining free days when upgrading mid-trial (Stripe needs ≥48h).
  const trialEnd = sub?.status === "trialing" && sub.trial_ends_at ? Math.floor(new Date(sub.trial_ends_at).getTime() / 1000) : null;
  const keepTrial = trialEnd && trialEnd > Date.now() / 1000 + 48 * 3600 ? trialEnd : undefined;

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: ctx.household.id,
    line_items: [{ price: await priceIdFor(parsed.data.plan, parsed.data.interval), quantity: 1 }],
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
