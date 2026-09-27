import { notFound } from "next/navigation";
import { z } from "zod";
import { getParentContext, requireParent } from "@/lib/auth/session";
import { parentT, type ParentKey } from "@/lib/i18n/parent";
import { signedAvatarMap } from "@/lib/avatars";
import { formatMoney } from "@/lib/money/format";
import { Badge, Card } from "@/components/ui";
import { KidEditor } from "./KidEditor";
import { AdjustmentForm } from "./AdjustmentForm";
import { CheckinStats } from "./CheckinStats";
import { checkinStats } from "@/lib/reports/weekly";
import { intlLocale, isLocale } from "@/lib/i18n";
import { localizeLedgerNote } from "@/lib/i18n/ledgerNotes";

export async function generateMetadata() {
  const ctx = await getParentContext();
  return { title: parentT(ctx?.locale ?? "en")("a.kid.metaTitle") };
}

const KIND_LABEL: Record<string, ParentKey> = {
  earning: "a.kind.earning",
  match: "a.kind.match",
  bonus: "a.kind.bonus",
  payout: "a.kind.payout",
  adjustment: "a.kind.adjustment",
  tax: "a.kind.tax",
  promo: "a.kind.promo",
};
const STATUS_LABEL: Record<string, ParentKey> = {
  pending: "a.status.pending",
  approved: "a.status.approved",
  sent_back: "a.status.sent_back",
  rejected: "a.status.rejected",
  reversed: "a.status.reversed",
  withdrawn: "a.status.withdrawn",
};
const METHOD_LABEL: Record<string, ParentKey> = {
  cash: "a.pay.method.cash",
  bank: "a.pay.method.bank",
  savings: "a.pay.method.savings",
  other: "a.pay.method.other",
};
const STATUS_TONE = { pending: "warn", approved: "good", sent_back: "bad", rejected: "neutral", reversed: "neutral", withdrawn: "neutral" } as const;

export default async function KidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireParent();
  const t = parentT(ctx.locale);
  const hid = ctx.household.id;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [{ data: kid }, { data: bal }, { data: ledger }, { data: subs }, { data: recentCheckins }, { count: checkinTotal }] = await Promise.all([
    ctx.supabase.from("kids").select("*").eq("household_id", hid).eq("id", id).maybeSingle(),
    ctx.supabase.from("kid_balances").select("*").eq("household_id", hid).eq("kid_id", id).maybeSingle(),
    ctx.supabase.from("ledger_entries").select("*").eq("household_id", hid).eq("kid_id", id).order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("submissions").select("id, chore_title_snapshot, amount_cents, status, submitted_at, review_comment").eq("household_id", hid).eq("kid_id", id).order("submitted_at", { ascending: false }).limit(20),
    ctx.supabase.from("kid_checkins").select("created_at").eq("household_id", hid).eq("kid_id", id).gte("created_at", since30).order("created_at", { ascending: false }).limit(1000),
    ctx.supabase.from("kid_checkins").select("id", { count: "exact", head: true }).eq("household_id", hid).eq("kid_id", id),
  ]);
  if (!kid) notFound();
  const avatars = await signedAvatarMap(ctx.supabase, [kid.avatar_path]);
  const money = (c: number) => formatMoney(c, ctx.household.currency, ctx.locale);
  const when = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(ctx.locale), { month: "short", day: "numeric", year: "numeric" });
  const writable = ctx.access === "full";

  return (
    <div className="flex flex-col gap-6">
      <KidEditor
        kid={{
          id: kid.id,
          name: kid.name,
          color: kid.color,
          sort_order: kid.sort_order,
          archived: Boolean(kid.archived_at),
          locale: isLocale(kid.locale) ? kid.locale : null,
        }}
        avatarUrl={kid.avatar_path ? (avatars[kid.avatar_path] ?? null) : null}
        householdId={hid}
        readOnly={!writable}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-bold text-ink-soft">{t("a.kid.balance")}</p>
          <p className="font-display text-3xl font-bold text-moss">{money(bal?.balance_cents ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-sm font-bold text-ink-soft">{t("a.kid.waiting")}</p>
          <p className="font-display text-3xl font-bold text-amber">{money(bal?.pending_cents ?? 0)}</p>
        </Card>
        {writable ? (
          <Card className="col-span-2 md:col-span-1">
            <AdjustmentForm kidId={kid.id} />
          </Card>
        ) : null}
      </div>

      <CheckinStats
        stats={checkinStats((recentCheckins ?? []).map((c) => c.created_at), checkinTotal ?? 0, now, ctx.household.timezone)}
        now={now}
        locale={ctx.locale}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-xl font-bold">{t("a.kid.recentChores")}</h2>
          {subs?.length ? (
            <ul className="divide-y divide-line">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.chore_title_snapshot}</span>
                    <span className="text-xs text-ink-soft">{when(s.submitted_at)}{s.review_comment ? ` · “${s.review_comment}”` : ""}</span>
                  </span>
                  <Badge tone={STATUS_TONE[s.status as keyof typeof STATUS_TONE] ?? "neutral"}>{STATUS_LABEL[s.status] ? t(STATUS_LABEL[s.status]!) : s.status.replace("_", " ")}</Badge>
                  <span className="w-20 text-right font-bold">{money(s.amount_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">{t("a.kid.nothingYet")}</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-display text-xl font-bold">{t("a.kid.moneyHistory")}</h2>
          {ledger?.length ? (
            <ul className="divide-y divide-line">
              {ledger.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{KIND_LABEL[l.kind] ? t(KIND_LABEL[l.kind]!) : l.kind}</span>
                    <span className="block truncate text-xs text-ink-soft">{when(l.created_at)}{l.note ? ` · ${localizeLedgerNote(l.note, ctx.locale)}` : ""}{l.method ? ` · ${METHOD_LABEL[l.method] ? t(METHOD_LABEL[l.method]!) : l.method}` : ""}</span>
                  </span>
                  <span className={`w-24 text-right font-bold ${l.amount_cents < 0 ? "text-plum" : "text-moss"}`}>
                    {l.amount_cents > 0 ? "+" : ""}{money(l.amount_cents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">{t("a.kid.noMoney")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
