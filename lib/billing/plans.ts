// Pricing and limits live here and only here. Enforced server-side.
//
// Model: the first kid is free. Each additional kid is $5 CAD/month
// (one Stripe subscription whose quantity = active kids − 1). New households
// get a 14-day trial where extra kids are free, so onboarding never blocks.

export type PlanId = "trial" | "family" | "family_plus" | "comp" | "free";

export const FREE_KIDS = 1;
export const PRICE_PER_EXTRA_KID_CENTS = 500;
export const EXTRA_KID_LOOKUP_KEY = "extra_kid_monthly";
export const MAX_KIDS = 30;

/**
 * Billing is switched off for now: every household has full access, unlimited
 * kids (up to MAX_KIDS) and nothing is charged. Set BILLING_ENABLED=true (and
 * flip public.billing_enforced() in SQL) to turn the per-kid pricing back on.
 */
export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

export interface PlanLimits {
  devices: number;
  parents: number;
}

export const LIMITS: PlanLimits = { devices: 5, parents: 4 };

export const PLAN_NAMES: Record<PlanId, string> = {
  trial: "Free trial",
  family: "Family",
  family_plus: "Family",
  comp: "Complimentary",
  free: "Free (1 kid)",
};

export function planFromLookupKey(lookupKey: string | null | undefined): PlanId | null {
  return lookupKey === EXTRA_KID_LOOKUP_KEY ? "family" : null;
}

/** Paid seats for a household with this many active kids (never below 1 while subscribed). */
export function billableExtraKids(activeKids: number): number {
  return Math.max(1, activeKids - FREE_KIDS);
}

/** Monthly price in cents for this many active kids. */
export function monthlyPriceCents(activeKids: number): number {
  return Math.max(0, activeKids - FREE_KIDS) * PRICE_PER_EXTRA_KID_CENTS;
}

export type LimitedResource = "devices" | "parents";

export function withinLimit(resource: LimitedResource, currentCount: number): boolean {
  return currentCount < LIMITS[resource];
}

/** Monthly recurring revenue in cents for one subscription row. */
export function mrrCents(plan: PlanId | string, quantity: number | null, status: string): number {
  if (plan !== "family" || !quantity) return 0;
  if (status !== "active" && status !== "past_due") return 0;
  return quantity * PRICE_PER_EXTRA_KID_CENTS;
}
