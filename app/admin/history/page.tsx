import Link from "next/link";
import { requireParent } from "@/lib/auth/session";
import { loadHistory, type HistoryFilters } from "@/lib/history";
import { formatMoney } from "@/lib/money/format";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { Badge, EmptyState, PageHeader, buttonClass } from "@/components/ui";

export const metadata = { title: "History" };

const TYPES = ["all", "submissions", "earning", "payout", "adjustment", "match"] as const;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireParent();
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
  const canExport = PLAN_LIMITS[ctx.plan].csvExport || ctx.access !== "full";
  const select = "min-h-10 rounded-xl border border-line bg-card px-3 text-sm";

  return (
    <>
      <PageHeader
        title="History"
        actions={
          canExport ? (
            <a href={`/admin/history/export?${qs}`} className={buttonClass("secondary")}>⬇ Export CSV</a>
          ) : (
            <Link href="/admin/settings/billing" className={buttonClass("ghost")} title="Family Plus">⬇ Export CSV (Family Plus)</Link>
          )
        }
      />
      <form className="mb-5 flex flex-wrap items-end gap-2" method="get">
        <select name="kid" defaultValue={filters.kid ?? ""} className={select} aria-label="Kid">
          <option value="">All kids</option>
          {(kids ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <select name="chore" defaultValue={filters.chore ?? ""} className={select} aria-label="Chore">
          <option value="">All chores</option>
          {(chores ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select name="type" defaultValue={filters.type} className={select} aria-label="Type">
          {TYPES.map((t) => <option key={t} value={t}>{t === "all" ? "Everything" : t}</option>)}
        </select>
        <input type="date" name="from" defaultValue={filters.from} className={select} aria-label="From" />
        <input type="date" name="to" defaultValue={filters.to} className={select} aria-label="To" />
        <button className={buttonClass("primary", "sm")}>Filter</button>
        {qs ? <Link href="/admin/history" className={buttonClass("ghost", "sm")}>Clear</Link> : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState emoji="📜" title="Nothing here yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-paper-deep/60 text-left text-xs font-black tracking-wide text-ink-soft uppercase">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Kid</th>
                <th className="px-4 py-2">What</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={`${r.type}-${r.id}`}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">
                    {new Date(r.at).toLocaleString(ctx.locale === "fr" ? "fr-CA" : "en-CA", { timeZone: ctx.household.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 font-bold">{r.kidName}</td>
                  <td className="px-4 py-2.5">
                    {r.title}
                    {r.note && r.type === "submission" ? <span className="block text-xs text-ink-soft">“{r.note}”</span> : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.type === "payout" ? "bad" : r.type === "submission" ? "warn" : "good"}>
                      {r.type === "submission" ? r.status?.replace("_", " ") : r.type}
                    </Badge>
                  </td>
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
