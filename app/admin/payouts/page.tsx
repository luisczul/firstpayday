import { requireParent } from "@/lib/auth/session";
import { signedAvatarMap } from "@/lib/avatars";
import { payoutTotals, type LedgerRow } from "@/lib/money/ledger";
import { PageHeader } from "@/components/ui";
import { PayoutsView, type PayoutKid } from "./PayoutsView";

export const metadata = { title: "Payouts" };

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ kid?: string }> }) {
  const ctx = await requireParent();
  const hid = ctx.household.id;
  const [{ data: kids }, { data: balances }, { data: payouts }] = await Promise.all([
    ctx.supabase.from("kids").select("id, name, color, avatar_path").eq("household_id", hid).is("archived_at", null).order("sort_order"),
    ctx.supabase.from("kid_balances").select("*").eq("household_id", hid),
    ctx.supabase.from("ledger_entries").select("id, kid_id, kind, amount_cents, method, note, created_at").eq("household_id", hid).eq("kind", "payout").order("created_at", { ascending: false }).limit(500),
  ]);
  const avatars = await signedAvatarMap(ctx.supabase, (kids ?? []).map((k) => k.avatar_path));
  const bal = new Map((balances ?? []).map((b) => [b.kid_id, b.balance_cents ?? 0]));
  const now = new Date();
  const items: PayoutKid[] = (kids ?? []).map((k) => {
    const rows = (payouts ?? []).filter((p) => p.kid_id === k.id);
    return {
      id: k.id,
      name: k.name,
      color: k.color,
      avatarUrl: k.avatar_path ? (avatars[k.avatar_path] ?? null) : null,
      balanceCents: bal.get(k.id) ?? 0,
      totals: payoutTotals(rows as LedgerRow[], now, ctx.household.timezone),
      history: rows.slice(0, 30).map((r) => ({ id: r.id, amountCents: -r.amount_cents, method: r.method, note: r.note, createdAt: r.created_at })),
    };
  });
  const { kid } = await searchParams;
  return (
    <>
      <PageHeader title="Payouts" subtitle="Record cash handed over or money moved to savings." />
      <PayoutsView kids={items} initialKidId={kid ?? items[0]?.id ?? null} currency={ctx.household.currency} locale={ctx.locale} readOnly={ctx.access !== "full"} />
    </>
  );
}
