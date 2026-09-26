import { NextResponse, type NextRequest } from "next/server";
import { getParentContext } from "@/lib/auth/session";
import { stripe } from "@/lib/billing/stripe";
import { appUrl } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ctx = await getParentContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!ctx.isOwner) return NextResponse.json({ error: "Only the owner can manage billing." }, { status: 403 });
  const customer = ctx.subscription?.stripe_customer_id;
  if (!customer) return NextResponse.redirect(new URL("/admin/settings/billing", req.url), 303);
  const session = await stripe().billingPortal.sessions.create({
    customer,
    return_url: `${appUrl()}/admin/settings/billing`,
  });
  return NextResponse.redirect(session.url, 303);
}
