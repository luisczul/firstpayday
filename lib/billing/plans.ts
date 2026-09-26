// Plan limits live here and only here (SPEC §19.1). Enforced server-side.

export type PlanId = "trial" | "family" | "family_plus" | "comp" | "free";
export type PaidPlanId = "family" | "family_plus";
export type Interval = "monthly" | "yearly";

export interface PlanLimits {
  kids: number;
  devices: number;
  parents: number;
  csvExport: boolean;
  savingsMatch: boolean;
  customThemes: boolean;
}

const FAMILY: PlanLimits = { kids: 3, devices: 2, parents: 2, csvExport: false, savingsMatch: false, customThemes: false };
const FAMILY_PLUS: PlanLimits = { kids: 8, devices: 5, parents: 4, csvExport: true, savingsMatch: true, customThemes: true };

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  trial: FAMILY_PLUS,
  family: FAMILY,
  family_plus: FAMILY_PLUS,
  comp: FAMILY_PLUS,
  free: FAMILY,
};

export const PLAN_NAMES: Record<PlanId, string> = {
  trial: "Free trial",
  family: "Family",
  family_plus: "Family Plus",
  comp: "Complimentary",
  free: "Free",
};

/** CAD prices in cents, for display and MRR. Stripe is the source of truth for charging. */
export const PLAN_PRICES: Record<PaidPlanId, Record<Interval, number>> = {
  family: { monthly: 499, yearly: 4900 },
  family_plus: { monthly: 799, yearly: 7900 },
};

export const LOOKUP_KEYS: Record<PaidPlanId, Record<Interval, string>> = {
  family: { monthly: "family_monthly", yearly: "family_yearly" },
  family_plus: { monthly: "family_plus_monthly", yearly: "family_plus_yearly" },
};

export function planFromLookupKey(lookupKey: string | null | undefined): PaidPlanId | null {
  if (!lookupKey) return null;
  if (lookupKey.startsWith("family_plus_")) return "family_plus";
  if (lookupKey.startsWith("family_")) return "family";
  return null;
}

export type LimitedResource = "kids" | "devices" | "parents";

export function withinLimit(plan: PlanId, resource: LimitedResource, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan][resource];
}

/** Monthly recurring revenue contribution in cents. */
export function mrrCents(plan: PlanId, interval: Interval | null, status: string): number {
  if ((plan !== "family" && plan !== "family_plus") || !interval) return 0;
  if (status !== "active" && status !== "past_due") return 0;
  const price = PLAN_PRICES[plan][interval];
  return interval === "yearly" ? Math.round(price / 12) : price;
}
