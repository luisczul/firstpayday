import { getParentContext, requireParent } from "@/lib/auth/session";
import { signedAvatarMap } from "@/lib/avatars";
import { PageHeader } from "@/components/ui";
import { parseSubtasks } from "@/lib/schedule/checklist";
import { loadPromotions } from "@/lib/familyPot";
import { isActiveAt } from "@/lib/money/promotions";
import { ApprovalQueue, type QueueItem } from "./ApprovalQueue";
import { RecentApprovals, type ApprovedItem } from "./RecentApprovals";
import { parentT } from "@/lib/i18n/parent";

export async function generateMetadata() {
  const ctx = await getParentContext();
  return { title: parentT(ctx?.locale ?? "en")("a.appr.title") };
}

export default async function ApprovalsPage() {
  const ctx = await requireParent();
  const t = parentT(ctx.locale);
  const { data } = await ctx.supabase
    .from("submissions")
    .select(
      "id, kid_id, quantity, unit_price_cents, amount_cents, chore_title_snapshot, submitted_at, resubmitted_at, review_comment, kids(name, color, avatar_path), chores(emoji, max_quantity, unit_label, subtasks, price_cents)",
    )
    .eq("household_id", ctx.household.id)
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  const { data: approved } = await ctx.supabase
    .from("submissions")
    .select("id, amount_cents, chore_title_snapshot, reviewed_at, kids(name, color, avatar_path), chores(emoji)")
    .eq("household_id", ctx.household.id)
    .eq("status", "approved")
    .gte("reviewed_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
    .order("reviewed_at", { ascending: false })
    .limit(30);

  // Promotions that were live when a waiting chore was submitted (paid on approval).
  const earliest = data?.[0]?.submitted_at;
  const promos = earliest ? await loadPromotions(ctx.supabase, ctx.household.id, { endedAfter: new Date(earliest) }) : [];

  const avatars = await signedAvatarMap(ctx.supabase, [...(data ?? []), ...(approved ?? [])].map((s) => s.kids?.avatar_path));
  const recent: ApprovedItem[] = (approved ?? []).map((s) => ({
    id: s.id,
    kidName: s.kids?.name ?? "?",
    kidColor: s.kids?.color ?? "#E08A1E",
    kidAvatar: s.kids?.avatar_path ? (avatars[s.kids.avatar_path] ?? null) : null,
    title: s.chore_title_snapshot,
    emoji: s.chores?.emoji ?? null,
    amountCents: s.amount_cents,
    reviewedAt: s.reviewed_at!,
  }));
  const items: QueueItem[] = (data ?? []).map((s) => ({
    id: s.id,
    kidId: s.kid_id,
    kidName: s.kids?.name ?? "?",
    kidColor: s.kids?.color ?? "#E08A1E",
    kidAvatar: s.kids?.avatar_path ? (avatars[s.kids.avatar_path] ?? null) : null,
    title: s.chore_title_snapshot,
    emoji: s.chores?.emoji ?? null,
    quantity: s.quantity,
    maxQuantity: Math.max(s.chores?.max_quantity ?? 1, s.quantity),
    unitLabel: s.chores?.unit_label ?? null,
    unitPriceCents: s.unit_price_cents,
    chorePriceCents: s.chores?.price_cents ?? s.unit_price_cents,
    submittedAt: s.submitted_at,
    resubmitted: Boolean(s.resubmitted_at),
    previousComment: s.resubmitted_at ? s.review_comment : null,
    subtasks: parseSubtasks(s.chores?.subtasks),
    promos: promos.filter((p) => isActiveAt(p, new Date(s.submitted_at))),
  }));

  return (
    <>
      <PageHeader
        title={t("a.appr.title")}
        subtitle={items.length ? t("a.appr.waiting", { n: items.length }) : undefined}
      />
      <ApprovalQueue
        items={items}
        currency={ctx.household.currency}
        locale={ctx.locale}
        readOnly={ctx.access !== "full"}
        matchPercent={ctx.household.savings_match_percent}
      />
      <RecentApprovals items={recent} currency={ctx.household.currency} locale={ctx.locale} readOnly={ctx.access !== "full"} />
    </>
  );
}
