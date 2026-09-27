import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Promotion } from "@/lib/money/promotions";

type Client = SupabaseClient<Database>;

export interface FamilyPot {
  collectedCents: number;
  spentCents: number;
  potCents: number;
  /** Taxes paid per kid (positive cents). */
  byKid: Record<string, number>;
  spends: { id: string; amountCents: number; note: string; createdAt: string }[];
}

/** Family tax pot: every tax row withheld from payouts, minus family treats. */
export async function loadFamilyPot(client: Client, householdId: string): Promise<FamilyPot> {
  const [{ data: taxes }, { data: spends }] = await Promise.all([
    client.from("ledger_entries").select("kid_id, amount_cents").eq("household_id", householdId).eq("kind", "tax"),
    client
      .from("family_pot_spends")
      .select("id, amount_cents, note, created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
  ]);
  const byKid: Record<string, number> = {};
  let collectedCents = 0;
  for (const t of taxes ?? []) {
    collectedCents -= t.amount_cents;
    byKid[t.kid_id] = (byKid[t.kid_id] ?? 0) - t.amount_cents;
  }
  const spentCents = (spends ?? []).reduce((s, r) => s + r.amount_cents, 0);
  return {
    collectedCents,
    spentCents,
    potCents: collectedCents - spentCents,
    byKid,
    spends: (spends ?? []).map((r) => ({ id: r.id, amountCents: r.amount_cents, note: r.note, createdAt: r.created_at })),
  };
}

export async function familyPotCents(client: Client, householdId: string): Promise<number> {
  return (await loadFamilyPot(client, householdId)).potCents;
}

/** Promotions that haven't ended yet (plus, optionally, ones that ended after `since`). */
export async function loadPromotions(client: Client, householdId: string, opts: { endedAfter?: Date } = {}): Promise<Promotion[]> {
  let q = client
    .from("promotions")
    .select("id, name, starts_at, ends_at, bonus_kind, bonus_value")
    .eq("household_id", householdId)
    .order("starts_at", { ascending: true });
  if (opts.endedAfter) q = q.gt("ends_at", opts.endedAfter.toISOString());
  const { data } = await q;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    bonusKind: p.bonus_kind === "percent" ? "percent" : "flat",
    bonusValue: p.bonus_value,
  }));
}
