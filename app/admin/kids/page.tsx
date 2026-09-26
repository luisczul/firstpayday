import Link from "next/link";
import { requireParent } from "@/lib/auth/session";
import { signedAvatarMap } from "@/lib/avatars";
import { formatMoney } from "@/lib/money/format";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { PageHeader } from "@/components/ui";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { AddKidButton } from "./AddKidButton";

export const metadata = { title: "Kids" };

export default async function KidsPage() {
  const ctx = await requireParent();
  const [{ data: kids }, { data: balances }] = await Promise.all([
    ctx.supabase.from("kids").select("*").eq("household_id", ctx.household.id).order("sort_order").order("created_at"),
    ctx.supabase.from("kid_balances").select("*").eq("household_id", ctx.household.id),
  ]);
  const avatars = await signedAvatarMap(ctx.supabase, (kids ?? []).map((k) => k.avatar_path));
  const bal = new Map((balances ?? []).map((b) => [b.kid_id, b]));
  const active = (kids ?? []).filter((k) => !k.archived_at);
  const archived = (kids ?? []).filter((k) => k.archived_at);
  const money = (c: number) => formatMoney(c, ctx.household.currency, ctx.locale);

  return (
    <>
      <PageHeader
        title="Kids"
        subtitle={`${active.length} of ${PLAN_LIMITS[ctx.plan].kids} on your plan`}
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
                <span className="block text-sm font-bold text-amber">{money(bal.get(k.id)?.pending_cents ?? 0)} waiting</span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
      {archived.length ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-bold text-ink-soft">Archived</h2>
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
