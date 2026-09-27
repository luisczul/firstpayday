import { billingEnabled, monthlyPriceCents } from "@/lib/billing/plans";
import Link from "next/link";
import { getParentContext, requireParent } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { signedAvatarMap } from "@/lib/avatars";
import { formatMoney } from "@/lib/money/format";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { PageHeader } from "@/components/ui";
import { AddKidButton } from "./AddKidButton";
import { timeAgo } from "@/lib/reports/weekly";

export async function generateMetadata() {
  const ctx = await getParentContext();
  return { title: parentT(ctx?.locale ?? "en")("a.kids.title") };
}

export default async function KidsPage() {
  const ctx = await requireParent();
  const t = parentT(ctx.locale);
  const now = new Date();
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const [{ data: kids }, { data: balances }, { data: checkins }] = await Promise.all([
    ctx.supabase.from("kids").select("*").eq("household_id", ctx.household.id).order("sort_order").order("created_at"),
    ctx.supabase.from("kid_balances").select("*").eq("household_id", ctx.household.id),
    ctx.supabase
      .from("kid_checkins")
      .select("kid_id, created_at")
      .eq("household_id", ctx.household.id)
      .gte("created_at", new Date(now.getTime() - 30 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  // Per kid: check-ins in the last 7 days and the latest one (within 30 days).
  const usage = new Map<string, { week: number; last: string }>();
  for (const c of checkins ?? []) {
    const u = usage.get(c.kid_id) ?? { week: 0, last: c.created_at };
    if (new Date(c.created_at).getTime() >= weekAgo) u.week++;
    usage.set(c.kid_id, u);
  }
  const avatars = await signedAvatarMap(ctx.supabase, (kids ?? []).map((k) => k.avatar_path));
  const bal = new Map((balances ?? []).map((b) => [b.kid_id, b]));
  const active = (kids ?? []).filter((k) => !k.archived_at);
  const archived = (kids ?? []).filter((k) => k.archived_at);
  const money = (c: number) => formatMoney(c, ctx.household.currency, ctx.locale);

  return (
    <>
      <PageHeader
        title={t("a.kids.title")}
        subtitle={`${t(active.length === 1 ? "a.kids.count.one" : "a.kids.count.other", { n: active.length })}${billingEnabled() ? ` · ${t("a.kids.billing", { price: money(500) })}${active.length > 1 ? ` ${t("a.kids.billingTotal", { total: money(monthlyPriceCents(active.length)) })}` : ""}` : ""}`}
        actions={ctx.access === "full" ? <AddKidButton /> : null}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((k) => (
          <Link
            key={k.id}
            href={`/admin/kids/${k.id}`}
            className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] ring-1 ring-line hover:ring-amber"
          >
            <KidAvatar name={k.name} color={k.color} avatarUrl={k.avatar_path ? (avatars[k.avatar_path] ?? null) : null} size={72} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-2xl font-bold text-ink">{k.name}</span>
              <span className="block font-display text-xl font-bold text-moss">{money(bal.get(k.id)?.balance_cents ?? 0)}</span>
              {(bal.get(k.id)?.pending_cents ?? 0) > 0 ? (
                <span className="block text-sm font-bold text-amber">{t("a.kids.waiting", { amount: money(bal.get(k.id)?.pending_cents ?? 0) })}</span>
              ) : null}
              <span className="block text-xs text-ink-soft">
                {usage.get(k.id)
                  ? t(usage.get(k.id)!.week === 1 ? "a.kids.checkins.one" : "a.kids.checkins.other", {
                      n: usage.get(k.id)!.week,
                      when: timeAgo(usage.get(k.id)!.last, now, ctx.locale),
                    })
                  : t("a.kids.noCheckins")}
              </span>
            </span>
          </Link>
        ))}
      </div>
      {archived.length ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-bold text-ink-soft">{t("a.kids.archived")}</h2>
          <div className="flex flex-wrap gap-2">
            {archived.map((k) => (
              <Link key={k.id} href={`/admin/kids/${k.id}`} className="rounded-full bg-card px-4 py-2 font-bold text-ink-soft ring-1 ring-line">
                {k.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
