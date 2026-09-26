import { notFound } from "next/navigation";
import { z } from "zod";
import { requireParent } from "@/lib/auth/session";
import { signedAvatarMap } from "@/lib/avatars";
import { formatMoney } from "@/lib/money/format";
import { Badge, Card } from "@/components/ui";
import { KidEditor } from "./KidEditor";
import { AdjustmentForm } from "./AdjustmentForm";

export const metadata = { title: "Kid" };

const KIND_LABEL: Record<string, string> = { earning: "⭐ Earned", match: "🎁 Savings match", payout: "💵 Payout", adjustment: "✏️ Adjustment" };
const STATUS_TONE = { pending: "warn", approved: "good", sent_back: "bad", rejected: "neutral" } as const;

export default async function KidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireParent();
  const hid = ctx.household.id;
  const [{ data: kid }, { data: bal }, { data: ledger }, { data: subs }] = await Promise.all([
    ctx.supabase.from("kids").select("*").eq("household_id", hid).eq("id", id).maybeSingle(),
    ctx.supabase.from("kid_balances").select("*").eq("household_id", hid).eq("kid_id", id).maybeSingle(),
    ctx.supabase.from("ledger_entries").select("*").eq("household_id", hid).eq("kid_id", id).order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("submissions").select("id, chore_title_snapshot, amount_cents, status, submitted_at, review_comment").eq("household_id", hid).eq("kid_id", id).order("submitted_at", { ascending: false }).limit(20),
  ]);
  if (!kid) notFound();
  const avatars = await signedAvatarMap(ctx.supabase, [kid.avatar_path]);
  const money = (c: number) => formatMoney(c, ctx.household.currency, ctx.locale);
  const when = (iso: string) => new Date(iso).toLocaleDateString(ctx.locale === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric", year: "numeric" });
  const writable = ctx.access === "full";

  return (
    <div className="flex flex-col gap-6">
      <KidEditor
        kid={{ id: kid.id, name: kid.name, color: kid.color, sort_order: kid.sort_order, archived: Boolean(kid.archived_at) }}
        avatarUrl={kid.avatar_path ? (avatars[kid.avatar_path] ?? null) : null}
        householdId={hid}
        readOnly={!writable}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-bold text-ink-soft">Balance</p>
          <p className="font-display text-3xl font-bold text-moss">{money(bal?.balance_cents ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-sm font-bold text-ink-soft">Waiting for check</p>
          <p className="font-display text-3xl font-bold text-amber">{money(bal?.pending_cents ?? 0)}</p>
        </Card>
        {writable ? (
          <Card className="col-span-2 md:col-span-1">
            <AdjustmentForm kidId={kid.id} />
          </Card>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-xl font-bold">Recent chores</h2>
          {subs?.length ? (
            <ul className="divide-y divide-line">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.chore_title_snapshot}</span>
                    <span className="text-xs text-ink-soft">{when(s.submitted_at)}{s.review_comment ? ` · “${s.review_comment}”` : ""}</span>
                  </span>
                  <Badge tone={STATUS_TONE[s.status as keyof typeof STATUS_TONE] ?? "neutral"}>{s.status.replace("_", " ")}</Badge>
                  <span className="w-20 text-right font-bold">{money(s.amount_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">Nothing yet.</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-display text-xl font-bold">Money history</h2>
          {ledger?.length ? (
            <ul className="divide-y divide-line">
              {ledger.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{KIND_LABEL[l.kind] ?? l.kind}</span>
                    <span className="block truncate text-xs text-ink-soft">{when(l.created_at)}{l.note ? ` · ${l.note}` : ""}{l.method ? ` · ${l.method}` : ""}</span>
                  </span>
                  <span className={`w-24 text-right font-bold ${l.amount_cents < 0 ? "text-plum" : "text-moss"}`}>
                    {l.amount_cents > 0 ? "+" : ""}{money(l.amount_cents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">No money yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
