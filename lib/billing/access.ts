import { FREE_KIDS, type PlanId } from "./plans";

export type HouseholdAccess = "full" | "read_only";

export interface SubscriptionLike {
  plan: PlanId | string;
  status: string;
  trial_ends_at: string | Date | null;
  past_due_since?: string | Date | null;
  stripe_subscription_id?: string | null;
}

export const PAST_DUE_GRACE_DAYS = 7;

/** True while a Stripe subscription pays for extra kids. */
export function hasPaidSubscription(sub: SubscriptionLike | null | undefined, now: Date): boolean {
  if (!sub?.stripe_subscription_id) return false;
  if (sub.status === "active" || sub.status === "trialing") return true;
  if (sub.status === "past_due") {
    const since = sub.past_due_since ? new Date(sub.past_due_since) : now;
    return now.getTime() - since.getTime() < PAST_DUE_GRACE_DAYS * 86_400_000;
  }
  return false;
}

export function inFreeTrial(sub: SubscriptionLike | null | undefined, now: Date): boolean {
  return sub?.plan === "trial" && Boolean(sub.trial_ends_at) && new Date(sub.trial_ends_at!) > now;
}

/**
 * Mirrors household_has_full_access() in SQL; keep both in sync.
 * Full access: comp, a live trial, a paid subscription, or at most one kid.
 * Otherwise (extra kids without paying) the board is read-only; nothing is deleted.
 */
export function getHouseholdAccess(
  sub: SubscriptionLike | null | undefined,
  now: Date,
  activeKids: number,
): HouseholdAccess {
  if (sub?.plan === "comp") return "full";
  if (inFreeTrial(sub, now)) return "full";
  if (hasPaidSubscription(sub, now)) return "full";
  return activeKids <= FREE_KIDS ? "full" : "read_only";
}

/** Whether adding one more kid needs a paid subscription first. */
export function needsPaymentForAnotherKid(
  sub: SubscriptionLike | null | undefined,
  now: Date,
  activeKids: number,
): boolean {
  if (sub?.plan === "comp" || inFreeTrial(sub, now) || hasPaidSubscription(sub, now)) return false;
  return activeKids + 1 > FREE_KIDS;
}

/** Whole days left in the trial (0 when over). */
export function trialDaysLeft(sub: SubscriptionLike | null | undefined, now: Date): number {
  if (!sub?.trial_ends_at || sub.plan !== "trial") return 0;
  return Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86_400_000));
}
