import { describe, expect, it } from "vitest";
import { getHouseholdAccess, trialDaysLeft } from "./access";
import { mrrCents, planFromLookupKey, withinLimit } from "./plans";

const now = new Date("2026-09-26T12:00:00Z");

describe("getHouseholdAccess", () => {
  it("full for comp, active, live trials and fresh past_due", () => {
    expect(getHouseholdAccess({ plan: "comp", status: "canceled", trial_ends_at: null }, now)).toBe("full");
    expect(getHouseholdAccess({ plan: "family", status: "active", trial_ends_at: null }, now)).toBe("full");
    expect(getHouseholdAccess({ plan: "trial", status: "trialing", trial_ends_at: "2026-10-01T00:00:00Z" }, now)).toBe("full");
    expect(getHouseholdAccess({ plan: "family", status: "past_due", trial_ends_at: null, past_due_since: "2026-09-22T00:00:00Z" }, now)).toBe("full");
    expect(getHouseholdAccess({ plan: "family", status: "past_due", trial_ends_at: null }, now)).toBe("full");
  });

  it("read-only otherwise", () => {
    expect(getHouseholdAccess(null, now)).toBe("read_only");
    expect(getHouseholdAccess({ plan: "trial", status: "trialing", trial_ends_at: "2026-09-20T00:00:00Z" }, now)).toBe("read_only");
    expect(getHouseholdAccess({ plan: "trial", status: "trialing", trial_ends_at: null }, now)).toBe("read_only");
    expect(getHouseholdAccess({ plan: "family", status: "past_due", trial_ends_at: null, past_due_since: "2026-09-18T00:00:00Z" }, now)).toBe("read_only");
    expect(getHouseholdAccess({ plan: "family", status: "canceled", trial_ends_at: null }, now)).toBe("read_only");
    expect(getHouseholdAccess({ plan: "family", status: "unpaid", trial_ends_at: null }, now)).toBe("read_only");
  });

  it("trial days left", () => {
    expect(trialDaysLeft({ plan: "trial", status: "trialing", trial_ends_at: "2026-09-29T00:00:00Z" }, now)).toBe(3);
    expect(trialDaysLeft({ plan: "trial", status: "trialing", trial_ends_at: "2026-09-01T00:00:00Z" }, now)).toBe(0);
    expect(trialDaysLeft({ plan: "family", status: "active", trial_ends_at: "2026-09-29T00:00:00Z" }, now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBe(0);
  });
});

describe("plans", () => {
  it("limits: 4th kid on Family is blocked, allowed on Family Plus", () => {
    expect(withinLimit("family", "kids", 2)).toBe(true);
    expect(withinLimit("family", "kids", 3)).toBe(false);
    expect(withinLimit("family_plus", "kids", 3)).toBe(true);
    expect(withinLimit("trial", "devices", 4)).toBe(true);
  });

  it("maps lookup keys to plans", () => {
    expect(planFromLookupKey("family_monthly")).toBe("family");
    expect(planFromLookupKey("family_plus_yearly")).toBe("family_plus");
    expect(planFromLookupKey("other")).toBeNull();
    expect(planFromLookupKey(null)).toBeNull();
  });

  it("MRR normalises yearly prices and ignores non-paying", () => {
    expect(mrrCents("family", "monthly", "active")).toBe(499);
    expect(mrrCents("family_plus", "yearly", "active")).toBe(658);
    expect(mrrCents("family", "monthly", "canceled")).toBe(0);
    expect(mrrCents("trial", "monthly", "active")).toBe(0);
    expect(mrrCents("family", null, "active")).toBe(0);
  });
});
