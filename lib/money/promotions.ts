import { percentOf } from "./ledger";

export type PromoKind = "flat" | "percent";

export interface Promotion {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  bonusKind: PromoKind;
  /** Cents for "flat", whole percent for "percent". */
  bonusValue: number;
}

/** The bonus one chore worth `amountCents` earns under `p`; mirrors promo_bonus_at(). */
export function promoBonusCents(p: Pick<Promotion, "bonusKind" | "bonusValue">, amountCents: number): number {
  return p.bonusKind === "flat" ? p.bonusValue : percentOf(amountCents, p.bonusValue);
}

/** Windows are [start, end): a chore submitted exactly at the end time doesn't count. */
export function isActiveAt(p: Pick<Promotion, "startsAt" | "endsAt">, at: Date): boolean {
  const t = at.getTime();
  return new Date(p.startsAt).getTime() <= t && t < new Date(p.endsAt).getTime();
}

export function promoStatus(p: Pick<Promotion, "startsAt" | "endsAt">, now: Date): "scheduled" | "active" | "ended" {
  if (now.getTime() < new Date(p.startsAt).getTime()) return "scheduled";
  return isActiveAt(p, now) ? "active" : "ended";
}

/**
 * Overlapping promotions never stack: the one paying the most for this chore
 * wins (ties go to the one ending first). Mirrors promo_bonus_at().
 */
export function bestPromo<P extends Promotion>(
  promos: readonly P[],
  at: Date,
  amountCents: number,
): { promo: P; bonusCents: number } | null {
  let best: { promo: P; bonusCents: number } | null = null;
  for (const p of promos) {
    if (!isActiveAt(p, at)) continue;
    const bonusCents = promoBonusCents(p, amountCents);
    if (
      !best ||
      bonusCents > best.bonusCents ||
      (bonusCents === best.bonusCents && new Date(p.endsAt).getTime() < new Date(best.promo.endsAt).getTime())
    ) {
      best = { promo: p, bonusCents };
    }
  }
  return best && best.bonusCents > 0 ? best : null;
}
