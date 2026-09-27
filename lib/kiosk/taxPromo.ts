import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Promotion } from "@/lib/money/promotions";

/** Family tax + live promotions for one kid's board (part of getBoard, same household filter). */
export interface KioskMoneyExtras {
  tax: { enabled: boolean; percent: number; paidCents: number };
  /** Everything ever paid out to this kid (positive cents). */
  paidOutCents: number;
  /** Promotions live right now, soonest-ending first. */
  promos: Promotion[];
}

export async function loadKioskMoneyExtras(
  admin: ReturnType<typeof createAdminClient>,
  householdId: string,
  kidId: string,
  now: Date,
): Promise<KioskMoneyExtras> {
  const iso = now.toISOString();
  const [{ data: h }, { data: taxes }, { data: promos }, { data: payouts }] = await Promise.all([
    admin.from("households").select("tax_enabled, tax_percent").eq("id", householdId).single(),
    admin.from("ledger_entries").select("amount_cents").eq("household_id", householdId).eq("kid_id", kidId).eq("kind", "tax"),
    admin
      .from("promotions")
      .select("id, name, starts_at, ends_at, bonus_kind, bonus_value")
      .eq("household_id", householdId)
      .lte("starts_at", iso)
      .gt("ends_at", iso)
      .order("ends_at", { ascending: true }),
    admin.from("ledger_entries").select("amount_cents").eq("household_id", householdId).eq("kid_id", kidId).eq("kind", "payout"),
  ]);
  return {
    tax: {
      enabled: Boolean(h?.tax_enabled),
      percent: h?.tax_percent ?? 10,
      paidCents: (taxes ?? []).reduce((s, t) => s - t.amount_cents, 0),
    },
    paidOutCents: (payouts ?? []).reduce((s, t) => s - t.amount_cents, 0),
    promos: (promos ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      startsAt: p.starts_at,
      endsAt: p.ends_at,
      bonusKind: p.bonus_kind === "percent" ? "percent" : "flat",
      bonusValue: p.bonus_value,
    })),
  };
}
