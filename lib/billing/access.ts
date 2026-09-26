import type { PlanId } from "./plans";

export type HouseholdAccess = "full" | "read_only";

export interface SubscriptionLike {
  plan: PlanId | string;
  status: string;
  trial_ends_at: string | Date | null;
  past_due_since?: string | Date | null;
}

export const PAST_DUE_GRACE_DAYS = 7;

/**
 * SPEC §19.5. Mirrors household_has_full_access() in SQL; keep both in sync.
 */
export function getHouseholdAccess(sub: SubscriptionLike | null | undefined, now: Date): HouseholdAccess {
  if (!sub) return "read_only";
  if (sub.plan === "comp") return "full";
  if (sub.status === "active") return "full";
  if (sub.status === "trialing") {
    return sub.trial_ends_at && new Date(sub.trial_ends_at) > now ? "full" : "read_only";
  }
  if (sub.status === "past_due") {
    const since = sub.past_due_since ? new Date(sub.past_due_since) : now;
    return now.getTime() - since.getTime() < PAST_DUE_GRACE_DAYS * 86_400_000 ? "full" : "read_only";
  }
  return "read_only";
}

/** Whole days left in the trial (0 when over). */
export function trialDaysLeft(sub: SubscriptionLike | null | undefined, now: Date): number {
  if (!sub?.trial_ends_at || sub.status !== "trialing") return 0;
  return Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86_400_000));
}
