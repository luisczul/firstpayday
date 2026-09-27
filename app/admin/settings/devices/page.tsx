import { cookies } from "next/headers";
import { requireParent, type ParentContext } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { LIMITS } from "@/lib/billing/plans";
import { KIOSK_COOKIE } from "@/lib/auth/adminMode";
import { formatMoney } from "@/lib/money/format";
import { PageHeader } from "@/components/ui";
import { SettingsNav } from "../SettingsNav";
import { DevicesList, type TabletUsage } from "./DevicesList";

export async function generateMetadata() {
  const ctx = await requireParent();
  return { title: parentT(ctx.locale)("b.tabs.tablets") };
}

const DAY = 86_400_000;
const PAGE = 1000; // PostgREST max_rows

interface SubmissionRow {
  device_id: string | null;
  kid_id: string;
  amount_cents: number;
  submitted_at: string;
}

async function loadSubmissions(ctx: ParentContext): Promise<SubmissionRow[]> {
  const rows: SubmissionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await ctx.supabase
      .from("submissions")
      .select("device_id, kid_id, amount_cents, submitted_at")
      .eq("household_id", ctx.household.id)
      .order("submitted_at", { ascending: false })
      .range(from, from + PAGE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Per-tablet usage from submissions; key "" collects submissions with no tablet. */
function aggregate(rows: SubmissionRow[], kidName: Map<string, string>, money: (c: number) => string): Map<string, TabletUsage> {
  const now = Date.now();
  const acc = new Map<string, { total: number; last7: number; last30: number; cents: number; kids: Map<string, number> }>();
  for (const r of rows) {
    const key = r.device_id ?? "";
    const a = acc.get(key) ?? { total: 0, last7: 0, last30: 0, cents: 0, kids: new Map<string, number>() };
    const age = now - new Date(r.submitted_at).getTime();
    a.total += 1;
    if (age <= 7 * DAY) a.last7 += 1;
    if (age <= 30 * DAY) a.last30 += 1;
    a.cents += r.amount_cents;
    a.kids.set(r.kid_id, (a.kids.get(r.kid_id) ?? 0) + 1);
    acc.set(key, a);
  }
  const out = new Map<string, TabletUsage>();
  for (const [key, a] of acc) {
    const topKids = [...a.kids]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 2)
      .map(([id, count]) => ({ name: kidName.get(id) ?? "?", count }));
    out.set(key, { total: a.total, last7: a.last7, last30: a.last30, money: money(a.cents), topKids });
  }
  return out;
}

export default async function DevicesPage() {
  const ctx = await requireParent();
  const hid = ctx.household.id;
  const [{ data: devices }, { data: kids }, submissions] = await Promise.all([
    ctx.supabase
      .from("devices")
      .select("id, name, last_seen_at, revoked_at, created_at")
      .eq("household_id", hid)
      .order("created_at", { ascending: false }),
    ctx.supabase.from("kids").select("id, name").eq("household_id", hid),
    loadSubmissions(ctx),
  ]);
  const money = (c: number) => formatMoney(c, ctx.household.currency, ctx.locale);
  const kidName = new Map((kids ?? []).map((k) => [k.id, k.name]));
  // Submissions with no tablet, or from a tablet that no longer exists, count as "Unknown tablet".
  const knownIds = new Set((devices ?? []).map((d) => d.id));
  const normalized = submissions.map((s) => (s.device_id && knownIds.has(s.device_id) ? s : { ...s, device_id: null }));
  const usage = aggregate(normalized, kidName, money);

  // Busiest tablet (last 30 days) first; Array.sort is stable so ties keep newest-first.
  const last30 = (id: string) => usage.get(id)?.last30 ?? 0;
  const sorted = [...(devices ?? [])].sort((a, b) => last30(b.id) - last30(a.id));
  const withUsage = sorted.filter((d) => usage.has(d.id)).length;
  const mostUsedId = withUsage >= 2 && sorted[0] && last30(sorted[0].id) > 0 ? sorted[0].id : null;

  const onKiosk = Boolean((await cookies()).get(KIOSK_COOKIE)?.value);
  return (
    <>
      <PageHeader title={parentT(ctx.locale)("b.common.settings")} />
      <SettingsNav active="/admin/settings/devices" locale={ctx.locale} />
      <DevicesList
        devices={sorted}
        usage={Object.fromEntries([...usage].filter(([id]) => id !== ""))}
        unknown={usage.get("") ?? null}
        mostUsedId={mostUsedId}
        limit={LIMITS.devices}
        onKiosk={onKiosk}
        locale={ctx.locale}
      />
    </>
  );
}
