import Link from "next/link";
import { getParentContext, requireParent } from "@/lib/auth/session";
import { parentT, type ParentKey } from "@/lib/i18n/parent";
import { loadHistory, type HistoryFilters } from "@/lib/history";
import { formatMoney } from "@/lib/money/format";
import { Badge, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { intlLocale } from "@/lib/i18n";
import { localizeLedgerNote } from "@/lib/i18n/ledgerNotes";

export async function generateMetadata() {
  const ctx = await getParentContext();
  return { title: parentT(ctx?.locale ?? "en")("a.hist.title") };
}

const TYPES = ["all", "submissions", "earning", "bonus", "promo", "payout", "tax", "adjustment", "match"] as const;
const BADGE: Record<string, ParentKey> = {
  earning: "a.hist.badge.earning",
  bonus: "a.hist.badge.bonus",
  promo: "a.hist.badge.promo",
  payout: "a.hist.badge.payout",
  tax: "a.hist.badge.tax",
  adjustment: "a.hist.badge.adjustment",
  match: "a.hist.badge.match",
};
const STATUS: Record<string, ParentKey> = {
  pending: "a.status.pending",
  approved: "a.status.approved",
  sent_back: "a.status.sent_back",
  rejected: "a.status.rejected",
  reversed: "a.status.reversed",
  withdrawn: "a.status.withdrawn",
};
const METHOD: Record<string, ParentKey> = {
  cash: "a.pay.method.cash",
  bank: "a.pay.method.bank",
  savings: "a.pay.method.savings",
  other: "a.pay.method.other",
};
const KIND: Record<string, ParentKey> = {
  earning: "a.kind.earning",
  bonus: "a.kind.bonus",
  promo: "a.kind.promo",
  tax: "a.kind.tax",
  adjustment: "a.kind.adjustment",
  match: "a.kind.match",
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireParent();
  const t = parentT(ctx.locale);
  const sp = await searchParams;
  const filters: HistoryFilters = {
    kid: sp.kid || undefined,
    chore: sp.chore || undefined,
    type: TYPES.includes(sp.type as (typeof TYPES)[number]) ? (sp.type as HistoryFilters["type"]) : "all",
    from: sp.from || undefined,
    to: sp.to || undefined,
  };
  const [rows, { data: kids }, { data: chores }] = await Promise.all([
    loadHistory(ctx, filters),
    ctx.supabase.from("kids").select("id, name").eq("household_id", ctx.household.id).order("sort_order"),
    ctx.supabase.from("chores").select("id, title").eq("household_id", ctx.household.id).order("title"),
  ]);
  const money = (c: number) => formatMoney(c, ctx.household.currency, ctx.locale);
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  const canExport = true;
  const select = "min-h-10 rounded-xl border border-line bg-card px-3 text-sm";
  // lib/history builds English titles for ledger rows (also used by the CSV); show them translated.
  const displayTitle = (r: (typeof rows)[number]) => {
    if (r.type === "payout") {
      const method = r.title.match(/^Payout \((\w+)\)$/)?.[1];
      // "💵 Cash" → "cash"
      const label = method && METHOD[method] ? t(METHOD[method]!).replace(/^\P{L}+/u, "").toLowerCase() : method;
      return label ? `${t("a.pay.payout")} (${label})` : t("a.pay.payout");
    }
    if (r.type !== "submission" && r.title === r.type && KIND[r.type]) return t(KIND[r.type]!);
    return r.type === "submission" ? r.title : (localizeLedgerNote(r.title, ctx.locale) ?? r.title);
  };

  return (
    <>
      <PageHeader
        title={t("a.hist.title")}
        actions={
          canExport ? (
            <a href={`/admin/history/export?${qs}`} className={buttonClass("secondary")}>{t("a.hist.export")}</a>
          ) : (
            <Link href="/admin/settings/billing" className={buttonClass("ghost")} title="Family Plus">{t("a.hist.exportPlus")}</Link>
          )
        }
      />
      <form className="mb-5 flex flex-wrap items-end gap-2" method="get">
        <select name="kid" defaultValue={filters.kid ?? ""} className={select} aria-label={t("a.hist.kid")}>
          <option value="">{t("a.hist.allKids")}</option>
          {(kids ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <select name="chore" defaultValue={filters.chore ?? ""} className={select} aria-label={t("a.hist.chore")}>
          <option value="">{t("a.hist.allChores")}</option>
          {(chores ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select name="type" defaultValue={filters.type} className={select} aria-label={t("a.hist.type")}>
          {TYPES.map((ty) => <option key={ty} value={ty}>{t(`a.hist.type.${ty}`)}</option>)}
        </select>
        <input type="date" name="from" defaultValue={filters.from} className={select} aria-label={t("a.hist.from")} />
        <input type="date" name="to" defaultValue={filters.to} className={select} aria-label={t("a.hist.to")} />
        <button className={buttonClass("primary", "sm")}>{t("a.hist.filter")}</button>
        {qs ? <Link href="/admin/history" className={buttonClass("ghost", "sm")}>{t("a.hist.clear")}</Link> : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState emoji="📜" title={t("a.hist.empty")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-paper-deep/60 text-left text-xs font-black tracking-wide text-ink-soft uppercase">
              <tr>
                <th className="px-4 py-2">{t("a.hist.date")}</th>
                <th className="px-4 py-2">{t("a.hist.kid")}</th>
                <th className="px-4 py-2">{t("a.hist.what")}</th>
                <th className="px-4 py-2">{t("a.hist.type")}</th>
                <th className="px-4 py-2">{t("a.hist.tablet")}</th>
                <th className="px-4 py-2 text-right">{t("a.hist.amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={`${r.type}-${r.id}`}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">
                    {new Date(r.at).toLocaleString(intlLocale(ctx.locale), { timeZone: ctx.household.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 font-bold">{r.kidName}</td>
                  <td className="px-4 py-2.5">
                    {displayTitle(r)}
                    {r.note && r.type === "submission" ? <span className="block text-xs text-ink-soft">“{r.note}”</span> : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.type === "payout" ? "bad" : r.type === "submission" ? "warn" : "good"}>
                      {r.type === "submission"
                        ? r.status && STATUS[r.status] ? t(STATUS[r.status]!) : r.status?.replace("_", " ")
                        : BADGE[r.type] ? t(BADGE[r.type]!) : r.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{r.tablet ?? "—"}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${r.amountCents < 0 ? "text-plum" : r.type === "submission" ? "text-ink-soft" : "text-moss"}`}>
                    {money(r.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
