import { describe, expect, it } from "vitest";
import { getHouseholdAccess, hasPaidSubscription, inFreeTrial, needsPaymentForAnotherKid, trialDaysLeft } from "./access";
import { billableExtraKids, monthlyPriceCents, mrrCents, planFromLookupKey, withinLimit } from "./plans";

const now = new Date("2026-09-26T12:00:00Z");
const trial = { plan: "trial", status: "trialing", trial_ends_at: "2026-10-01T00:00:00Z" };
const expiredTrial = { plan: "trial", status: "trialing", trial_ends_at: "2026-09-20T00:00:00Z" };
const paid = { plan: "family", status: "active", trial_ends_at: null, stripe_subscription_id: "sub_1" };

describe("getHouseholdAccess (first kid free, $5 per extra kid)", () => {
  it("comp, live trials and paid subscriptions are always full", () => {
    expect(getHouseholdAccess({ plan: "comp", status: "canceled", trial_ends_at: null }, now, 8)).toBe("full");
    expect(getHouseholdAccess(trial, now, 5)).toBe("full");
    expect(getHouseholdAccess(paid, now, 5)).toBe("full");
    expect(getHouseholdAccess({ ...paid, status: "trialing" }, now, 3)).toBe("full");
  });

  it("one kid is free forever", () => {
    expect(getHouseholdAccess(expiredTrial, now, 1)).toBe("full");
    expect(getHouseholdAccess(null, now, 0)).toBe("full");
    expect(getHouseholdAccess({ ...paid, status: "canceled" }, now, 1)).toBe("full");
  });

  it("extra kids without paying → read-only", () => {
    expect(getHouseholdAccess(expiredTrial, now, 2)).toBe("read_only");
    expect(getHouseholdAccess({ ...paid, status: "canceled" }, now, 3)).toBe("read_only");
    expect(getHouseholdAccess({ plan: "trial", status: "trialing", trial_ends_at: null }, now, 2)).toBe("read_only");
  });

  it("past_due keeps a 7-day grace", () => {
    expect(getHouseholdAccess({ ...paid, status: "past_due", past_due_since: "2026-09-22T00:00:00Z" }, now, 3)).toBe("full");
    expect(getHouseholdAccess({ ...paid, status: "past_due" }, now, 3)).toBe("full");
    expect(getHouseholdAccess({ ...paid, status: "past_due", past_due_since: "2026-09-18T00:00:00Z" }, now, 3)).toBe("read_only");
  });

  it("helpers", () => {
    expect(hasPaidSubscription(null, now)).toBe(false);
    expect(hasPaidSubscription({ ...paid, stripe_subscription_id: null }, now)).toBe(false);
    expect(inFreeTrial(trial, now)).toBe(true);
    expect(inFreeTrial(expiredTrial, now)).toBe(false);
  });

  it("adding a second kid needs payment only outside trial/paid/comp", () => {
    expect(needsPaymentForAnotherKid(expiredTrial, now, 0)).toBe(false);
    expect(needsPaymentForAnotherKid(expiredTrial, now, 1)).toBe(true);
    expect(needsPaymentForAnotherKid(trial, now, 1)).toBe(false);
    expect(needsPaymentForAnotherKid(paid, now, 4)).toBe(false);
    expect(needsPaymentForAnotherKid({ plan: "comp", status: "active", trial_ends_at: null }, now, 4)).toBe(false);
  });

  it("trial days left", () => {
    expect(trialDaysLeft(trial, now)).toBe(5);
    expect(trialDaysLeft(expiredTrial, now)).toBe(0);
    expect(trialDaysLeft(paid, now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBe(0);
  });
});

describe("plans", () => {
  it("prices: first kid free, then $5 each", () => {
    expect(monthlyPriceCents(0)).toBe(0);
    expect(monthlyPriceCents(1)).toBe(0);
    expect(monthlyPriceCents(2)).toBe(500);
    expect(monthlyPriceCents(3)).toBe(1000);
    expect(billableExtraKids(1)).toBe(1);
    expect(billableExtraKids(3)).toBe(2);
  });

  it("limits and lookup keys", () => {
    expect(withinLimit("devices", 4)).toBe(true);
    expect(withinLimit("devices", 5)).toBe(false);
    expect(withinLimit("parents", 3)).toBe(true);
    expect(planFromLookupKey("extra_kid_monthly")).toBe("family");
    expect(planFromLookupKey("other")).toBeNull();
  });

  it("MRR = quantity × $5 for active/past_due", () => {
    expect(mrrCents("family", 2, "active")).toBe(1000);
    expect(mrrCents("family", 2, "past_due")).toBe(1000);
    expect(mrrCents("family", 2, "canceled")).toBe(0);
    expect(mrrCents("family", null, "active")).toBe(0);
    expect(mrrCents("trial", 2, "active")).toBe(0);
  });
});
