import { describe, expect, it } from "vitest";
import { formatMoney, formatPrice, parseMoneyToCents } from "./format";
import { balanceOf, checkPayout, matchFor, payoutTotals, type LedgerRow } from "./ledger";

describe("format", () => {
  it("formats cents with Intl in the household currency", () => {
    expect(formatMoney(4200)).toBe("$42.00");
    expect(formatMoney(-2000, "CAD", "en")).toBe("-$20.00");
    expect(formatMoney(1250, "CAD", "fr").replace(/\s/g, " ")).toBe("12,50 $");
    expect(formatMoney(500, "USD", "en-US")).toBe("$5.00");
    // Latin American Spanish (es-419), not Spain's "12,50 $".
    expect(formatMoney(1250, "CAD", "es")).toBe("$12.50");
    expect(formatMoney(123450, "MXN", "es")).toBe("$1,234.50");
    expect(formatMoney(1250, "BRL", "pt").replace(/\s/g, " ")).toBe("R$ 12,50");
    expect(formatPrice(200, "CAD", "pt").replace(/\s/g, " ")).toBe("$ 2");
  });

  it("price chips drop .00 but keep cents", () => {
    expect(formatPrice(500)).toBe("$5");
    expect(formatPrice(450)).toBe("$4.50");
    expect(formatPrice(500)).toBe("$5"); // cached formatter path
  });

  it("parses parent-typed amounts", () => {
    expect(parseMoneyToCents("12")).toBe(1200);
    expect(parseMoneyToCents("12.5")).toBe(1250);
    expect(parseMoneyToCents("0.50")).toBe(50);
    expect(parseMoneyToCents(".50")).toBe(50);
    expect(parseMoneyToCents(".")).toBeNull();
    expect(parseMoneyToCents("12,05")).toBe(1205);
    expect(parseMoneyToCents(" $7.99 ")).toBe(799);
    expect(parseMoneyToCents("-3")).toBe(-300);
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("1.234")).toBeNull();
  });
});

describe("ledger", () => {
  it("balance is the sum of rows", () => {
    expect(balanceOf([])).toBe(0);
    expect(balanceOf([{ amount_cents: 1000 }, { amount_cents: 500 }, { amount_cents: -2000 }])).toBe(-500);
  });

  it("savings match rounds down and is off at 0%", () => {
    expect(matchFor(1000, 50)).toBe(500);
    expect(matchFor(333, 50)).toBe(166);
    expect(matchFor(1000, 0)).toBe(0);
    expect(matchFor(0, 50)).toBe(0);
  });

  it("payouts must be positive and within balance unless allowed", () => {
    expect(checkPayout(2000, 4200, false)).toEqual({ ok: true, amountCents: 2000 });
    expect(checkPayout(0, 4200, false)).toEqual({ ok: false, reason: "not_positive" });
    expect(checkPayout(10.5, 4200, false)).toEqual({ ok: false, reason: "not_positive" });
    expect(checkPayout(5000, 4200, false)).toEqual({ ok: false, reason: "exceeds_balance" });
    expect(checkPayout(5000, 4200, true)).toEqual({ ok: true, amountCents: 5000 });
  });

  it("payout totals by local month and year", () => {
    const rows: LedgerRow[] = [
      { kind: "payout", amount_cents: -2000, created_at: "2026-09-10T15:00:00Z" },
      { kind: "payout", amount_cents: -500, created_at: new Date("2026-08-10T15:00:00Z") },
      { kind: "payout", amount_cents: -700, created_at: "2025-09-10T15:00:00Z" },
      { kind: "earning", amount_cents: 900, created_at: "2026-09-10T15:00:00Z" },
      // Oct 1 00:30 UTC is still Sep 30 in Toronto.
      { kind: "payout", amount_cents: -100, created_at: "2026-10-01T00:30:00Z" },
    ];
    expect(payoutTotals(rows, new Date("2026-09-26T12:00:00Z"), "America/Toronto")).toEqual({
      monthCents: 2100,
      yearCents: 2600,
    });
  });
});
