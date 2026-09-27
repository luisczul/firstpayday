export type LedgerKind = "earning" | "payout" | "adjustment" | "match" | "bonus" | "tax" | "promo";

export interface LedgerRow {
  kind: LedgerKind;
  amount_cents: number;
  created_at: string | Date;
}

/** Balance is always the sum of ledger rows (SPEC §3). */
export function balanceOf(rows: readonly Pick<LedgerRow, "amount_cents">[]): number {
  return rows.reduce((sum, r) => sum + r.amount_cents, 0);
}

/** Savings match for an approved amount; mirrors approve_submission() (integer division). */
export function matchFor(amountCents: number, matchPercent: number): number {
  if (matchPercent <= 0 || amountCents <= 0) return 0;
  return Math.floor((amountCents * matchPercent) / 100);
}

export type PayoutCheck =
  | { ok: true; amountCents: number }
  | { ok: false; reason: "not_positive" | "exceeds_balance" };

/** Payout validation (SPEC §8 A4): positive, and ≤ balance unless negatives are allowed. */
export function checkPayout(amountCents: number, balanceCents: number, allowNegative: boolean): PayoutCheck {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, reason: "not_positive" };
  if (!allowNegative && amountCents > balanceCents) return { ok: false, reason: "exceeds_balance" };
  return { ok: true, amountCents };
}

/** Totals of payouts (as positive cents) this month and this year, in the household timezone. */
export function payoutTotals(
  rows: readonly LedgerRow[],
  now: Date,
  zone: string,
): { monthCents: number; yearCents: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit" });
  const [nowYear, nowMonth] = fmt.format(now).split("-");
  let monthCents = 0;
  let yearCents = 0;
  for (const r of rows) {
    if (r.kind !== "payout") continue;
    const [y, m] = fmt.format(new Date(r.created_at)).split("-");
    if (y !== nowYear) continue;
    yearCents += -r.amount_cents;
    if (m === nowMonth) monthCents += -r.amount_cents;
  }
  return { monthCents, yearCents };
}

/** Round half up for non-negative integer cents; mirrors SQL round(x * pct / 100.0). */
export function percentOf(cents: number, percent: number): number {
  if (cents <= 0 || percent <= 0) return 0;
  return Math.floor((cents * percent + 50) / 100);
}

/**
 * Family tax on a payout; mirrors record_payout(). The kid's balance goes down
 * by the gross; they get the net in hand and the tax goes to the family pot.
 */
export function payoutSplit(
  grossCents: number,
  tax: { enabled: boolean; percent: number },
): { grossCents: number; taxCents: number; netCents: number } {
  const taxCents = tax.enabled ? percentOf(grossCents, tax.percent) : 0;
  return { grossCents, taxCents, netCents: grossCents - taxCents };
}

/** Taxes collected (positive cents) from ledger rows. */
export function taxesPaid(rows: readonly Pick<LedgerRow, "kind" | "amount_cents">[]): number {
  return rows.reduce((sum, r) => (r.kind === "tax" ? sum - r.amount_cents : sum), 0);
}
