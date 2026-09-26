import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { mrrCents, PLAN_NAMES, type Interval, type PlanId } from "@/lib/billing/plans";
import { formatMoney } from "@/lib/money/format";
import { brand } from "@/lib/brand";
import { Badge, Card } from "@/components/ui";
import { HouseholdActions } from "./HouseholdActions";

export const metadata = { title: "Platform" };
export const dynamic = "force-dynamic";

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string }> }) {
  await requirePlatformAdmin();
  const { q, view } = await searchParams;
  const admin = createAdminClient();
  const [{ data: households }, { data: subs }, { data: kids }, { data: owners }, { data: audit }] = await Promise.all([
    admin.from("households").select("id, name, created_at, last_activity_at, timezone, currency, locale").order("created_at", { ascending: false }),
    admin.from("subscriptions").select("*"),
    admin.from("kids").select("household_id").is("archived_at", null),
    admin.from("household_members").select("household_id, user_id").eq("role", "owner"),
    admin.from("audit_log").select("*").order("created_at", { ascending: false }).limit(20),
  ]);

  // Owner emails (auth.users) — fine at small scale; paginate listUsers later if needed.
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((usersPage?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const ownerEmail = new Map<string, string>();
  for (const o of owners ?? []) if (!ownerEmail.has(o.household_id)) ownerEmail.set(o.household_id, emailById.get(o.user_id) ?? "");
  const subBy = new Map((subs ?? []).map((s) => [s.household_id, s]));
  const kidCount = new Map<string, number>();
  for (const k of kids ?? []) kidCount.set(k.household_id, (kidCount.get(k.household_id) ?? 0) + 1);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const all = subs ?? [];
  const activeTrials = all.filter((s) => s.plan === "trial" && s.status === "trialing" && s.trial_ends_at && new Date(s.trial_ends_at) > now).length;
  const paying = all.filter((s) => (s.plan === "family" || s.plan === "family_plus") && ["active", "past_due", "trialing"].includes(s.status) && s.stripe_subscription_id);
  const intervalOf = (priceId: string | null): Interval | null =>
    !priceId ? null : [process.env.STRIPE_PRICE_FAMILY_YEARLY, process.env.STRIPE_PRICE_FAMILY_PLUS_YEARLY].includes(priceId) ? "yearly" : "monthly";
  const mrr = paying.reduce((sum, s) => sum + mrrCents(s.plan as PlanId, intervalOf(s.stripe_price_id), s.status), 0);
  const everPaid = all.filter((s) => s.stripe_subscription_id).length;
  const conversion = all.length ? Math.round((everPaid / all.length) * 100) : 0;
  const churned = all.filter((s) => s.status === "canceled" && s.updated_at && new Date(s.updated_at) >= monthStart).length;

  const rows = (households ?? []).filter((h) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return h.name.toLowerCase().includes(needle) || (ownerEmail.get(h.id) ?? "").toLowerCase().includes(needle);
  });
  const viewing = view ? (households ?? []).find((h) => h.id === view) : null;
  const stripeBase = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test";
  const money = (c: number) => formatMoney(c, "CAD", "en");
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "2-digit" }) : "—");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">{brand.name} · Platform</h1>
        <Link href="/admin" className="font-bold text-maple">← My household</Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          ["Households", String(all.length)],
          ["Active trials", String(activeTrials)],
          ["Paying · Family", String(paying.filter((s) => s.plan === "family").length)],
          ["Paying · Plus", String(paying.filter((s) => s.plan === "family_plus").length)],
          ["MRR", money(mrr)],
          ["Trial → paid", `${conversion}%`],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs font-bold text-ink-soft uppercase">{label}</p>
            <p className="font-display text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
      <p className="-mt-5 mb-6 text-sm text-ink-soft">Churn this month: {churned} · Comp: {all.filter((s) => s.plan === "comp").length}</p>

      {viewing ? (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Support view: {viewing.name} (read-only)</h2>
            <Link href="/platform" className="text-sm font-bold text-maple">Close</Link>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-paper p-3 text-xs">{JSON.stringify({ household: viewing, subscription: subBy.get(viewing.id), kids: kidCount.get(viewing.id) ?? 0, owner: ownerEmail.get(viewing.id) }, null, 2)}</pre>
        </Card>
      ) : null}

      <form className="mb-4" method="get">
        <input name="q" defaultValue={q} placeholder="Search name or owner email…" className="min-h-11 w-full max-w-md rounded-xl border border-line bg-card px-4" />
      </form>

      <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-line">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-paper-deep/60 text-left text-xs font-black text-ink-soft uppercase">
            <tr>
              <th className="px-3 py-2">Household</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Trial end</th>
              <th className="px-3 py-2">Kids</th>
              <th className="px-3 py-2">Last activity</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((h) => {
              const s = subBy.get(h.id);
              return (
                <tr key={h.id}>
                  <td className="px-3 py-2 font-bold">{h.name}</td>
                  <td className="px-3 py-2">{ownerEmail.get(h.id)}</td>
                  <td className="px-3 py-2">{s ? PLAN_NAMES[s.plan as PlanId] : "—"}</td>
                  <td className="px-3 py-2"><Badge tone={s?.status === "active" || s?.plan === "comp" ? "good" : s?.status === "trialing" ? "warn" : "bad"}>{s?.status ?? "—"}</Badge></td>
                  <td className="px-3 py-2">{date(s?.trial_ends_at ?? null)}</td>
                  <td className="px-3 py-2">{kidCount.get(h.id) ?? 0}</td>
                  <td className="px-3 py-2">{date(h.last_activity_at)}</td>
                  <td className="px-3 py-2">{date(h.created_at)}</td>
                  <td className="px-3 py-2">
                    <HouseholdActions
                      householdId={h.id}
                      isComp={s?.plan === "comp"}
                      canExtend={!s?.stripe_subscription_id && s?.plan !== "comp"}
                      stripeUrl={s?.stripe_customer_id ? `${stripeBase}/customers/${s.stripe_customer_id}` : null}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 mb-3 font-display text-xl font-bold">Audit log</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {(audit ?? []).map((a) => (
          <li key={a.id} className="rounded-lg bg-card px-3 py-2 ring-1 ring-line">
            <b>{a.action}</b> · {emailById.get(a.actor ?? "") ?? a.actor} · {(households ?? []).find((h) => h.id === a.household_id)?.name ?? a.household_id} · {new Date(a.created_at).toLocaleString("en-CA")}
          </li>
        ))}
      </ul>
    </main>
  );
}
