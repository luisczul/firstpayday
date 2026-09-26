import { requireParent } from "@/lib/auth/session";
import { signedAvatarMap } from "@/lib/avatars";
import { PageHeader } from "@/components/ui";
import { ApprovalQueue, type QueueItem } from "./ApprovalQueue";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const ctx = await requireParent();
  const { data } = await ctx.supabase
    .from("submissions")
    .select(
      "id, kid_id, quantity, unit_price_cents, amount_cents, chore_title_snapshot, submitted_at, resubmitted_at, review_comment, kids(name, color, avatar_path), chores(emoji, max_quantity, unit_label)",
    )
    .eq("household_id", ctx.household.id)
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  const avatars = await signedAvatarMap(ctx.supabase, (data ?? []).map((s) => s.kids?.avatar_path));
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
    submittedAt: s.submitted_at,
    resubmitted: Boolean(s.resubmitted_at),
    previousComment: s.resubmitted_at ? s.review_comment : null,
  }));

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle={items.length ? `${items.length} waiting for your check` : undefined}
      />
      <ApprovalQueue
        items={items}
        currency={ctx.household.currency}
        locale={ctx.locale}
        readOnly={ctx.access !== "full"}
        matchPercent={ctx.household.savings_match_percent}
      />
    </>
  );
}
