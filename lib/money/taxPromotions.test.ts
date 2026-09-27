import { describe, expect, it } from "vitest";
import { payoutSplit, percentOf, taxesPaid } from "./ledger";
import { bestPromo, isActiveAt, promoBonusCents, promoStatus, type Promotion } from "./promotions";

describe("family tax", () => {
  it("withholds the tax from the payout: $10 at 10% → $9 in hand, $1 to the pot", () => {
    expect(payoutSplit(1000, { enabled: true, percent: 10 })).toEqual({ grossCents: 1000, taxCents: 100, netCents: 900 });
  });
  it("is nothing when turned off", () => {
    expect(payoutSplit(1000, { enabled: false, percent: 10 })).toEqual({ grossCents: 1000, taxCents: 0, netCents: 1000 });
  });
  it("rounds half up to the cent like SQL round()", () => {
    expect(percentOf(5, 10)).toBe(1); // 0.5 → 1
    expect(percentOf(4, 10)).toBe(0); // 0.4 → 0
    expect(percentOf(333, 15)).toBe(50); // 49.95 → 50
    expect(payoutSplit(333, { enabled: true, percent: 15 })).toEqual({ grossCents: 333, taxCents: 50, netCents: 283 });
    expect(percentOf(0, 10)).toBe(0);
    expect(percentOf(100, 0)).toBe(0);
  });
  it("sums taxes paid from ledger rows as a positive amount", () => {
    expect(
      taxesPaid([
        { kind: "tax", amount_cents: -100 },
        { kind: "payout", amount_cents: -900 },
        { kind: "tax", amount_cents: -25 },
        { kind: "earning", amount_cents: 500 },
      ]),
    ).toBe(125);
    expect(taxesPaid([])).toBe(0);
  });
});

const promo = (over: Partial<Promotion>): Promotion => ({
  id: over.id ?? "p",
  name: "Promo",
  startsAt: "2026-09-26T12:00:00Z",
  endsAt: "2026-09-26T22:00:00Z",
  bonusKind: "flat",
  bonusValue: 100,
  ...over,
});

describe("promotions", () => {
  it("flat is per chore; percent is of the chore amount, rounded to cents", () => {
    expect(promoBonusCents({ bonusKind: "flat", bonusValue: 100 }, 250)).toBe(100);
    expect(promoBonusCents({ bonusKind: "percent", bonusValue: 20 }, 250)).toBe(50);
    expect(promoBonusCents({ bonusKind: "percent", bonusValue: 15 }, 333)).toBe(50);
  });

  it("windows are [start, end)", () => {
    const p = promo({});
    expect(isActiveAt(p, new Date("2026-09-26T11:59:59Z"))).toBe(false);
    expect(isActiveAt(p, new Date("2026-09-26T12:00:00Z"))).toBe(true);
    expect(isActiveAt(p, new Date("2026-09-26T21:59:59Z"))).toBe(true);
    expect(isActiveAt(p, new Date("2026-09-26T22:00:00Z"))).toBe(false);
    expect(promoStatus(p, new Date("2026-09-26T11:00:00Z"))).toBe("scheduled");
    expect(promoStatus(p, new Date("2026-09-26T13:00:00Z"))).toBe("active");
    expect(promoStatus(p, new Date("2026-09-26T23:00:00Z"))).toBe("ended");
  });

  it("overlapping promotions don't stack: the best single one wins for that chore", () => {
    const flat = promo({ id: "flat", bonusKind: "flat", bonusValue: 100 });
    const pct = promo({ id: "pct", bonusKind: "percent", bonusValue: 20, endsAt: "2026-09-27T00:00:00Z" });
    const at = new Date("2026-09-26T15:00:00Z");
    expect(bestPromo([flat, pct], at, 300)).toEqual({ promo: flat, bonusCents: 100 }); // 20% of $3 = $0.60
    expect(bestPromo([flat, pct], at, 1000)).toEqual({ promo: pct, bonusCents: 200 }); // 20% of $10 = $2
    // A tie goes to the one ending first.
    expect(bestPromo([pct, flat], at, 500)?.promo.id).toBe("flat");
    expect(bestPromo([flat, pct], at, 500)?.promo.id).toBe("flat");
  });

  it("ignores promotions outside the window and zero bonuses", () => {
    const later = promo({ startsAt: "2026-09-27T00:00:00Z", endsAt: "2026-09-28T00:00:00Z" });
    expect(bestPromo([later], new Date("2026-09-26T15:00:00Z"), 500)).toBeNull();
    expect(bestPromo([], new Date(), 500)).toBeNull();
    expect(bestPromo([promo({ bonusKind: "percent", bonusValue: 10 })], new Date("2026-09-26T15:00:00Z"), 0)).toBeNull();
  });
});
