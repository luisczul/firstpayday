import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, subscriptionIdFromInvoice, syncSubscription } from "@/lib/billing/stripe";
import { requireEnv, appUrl } from "@/lib/env";
import { emailLayout, sendEmail } from "@/lib/email/send";
import { paymentFailedEmail } from "@/lib/email/parentEmails";
import { asLocale } from "@/lib/i18n";
import { brand } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The source of truth for access (SPEC §19.4). Idempotent via stripe_events. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature ?? "", requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: inserted } = await admin
    .from("stripe_events")
    .upsert({ id: event.id, type: event.type, payload: event as unknown as never }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (!inserted?.length) {
    const { data: prior } = await admin.from("stripe_events").select("processed_at").eq("id", event.id).single();
    if (prior?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
    await admin.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("stripe webhook failed", event.type, e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const householdId = session.client_reference_id;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (householdId && subId) await syncSubscription(subId, householdId);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object.id);
      break;
    case "invoice.paid": {
      const subId = subscriptionIdFromInvoice(event.data.object);
      if (subId) await syncSubscription(subId);
      break;
    }
    case "invoice.payment_failed": {
      const subId = subscriptionIdFromInvoice(event.data.object);
      if (subId) {
        await syncSubscription(subId);
        await emailOwnersPaymentFailed(subId);
      }
      break;
    }
    default:
      break;
  }
}

async function emailOwnersPaymentFailed(subscriptionId: string) {
  const admin = createAdminClient();
  const { data: sub } = await admin.from("subscriptions").select("household_id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
  if (!sub) return;
  const { data: home } = await admin.from("households").select("locale").eq("id", sub.household_id).maybeSingle();
  const { data: owners } = await admin.from("household_members").select("user_id").eq("household_id", sub.household_id).eq("role", "owner");
  const emails = (
    await Promise.all((owners ?? []).map(async (o) => (await admin.auth.admin.getUserById(o.user_id)).data.user?.email))
  ).filter((e): e is string => Boolean(e));
  if (!emails.length) return;
  const mail = paymentFailedEmail({ locale: asLocale(home?.locale), brand: brand.name, billingUrl: `${appUrl()}/admin/settings/billing` });
  await sendEmail({ to: emails, subject: mail.subject, html: emailLayout(mail.title, mail.body) });
}
