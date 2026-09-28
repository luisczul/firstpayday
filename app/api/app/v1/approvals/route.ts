import { NextResponse } from "next/server";
import { signedAvatarMap } from "@/lib/avatars";
import { appParent, ok } from "@/lib/app/api";

/** Chores waiting for the parent's check, oldest first (same data as /admin/approvals). */
export async function GET(req: Request) {
  const ctx = await appParent(req);
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.supabase
    .from("submissions")
    .select("id, kid_id, chore_id, quantity, unit_price_cents, amount_cents, chore_title_snapshot, submitted_at, resubmitted_at, kids(name, color, avatar_path), chores(title, emoji, unit_label)")
    .eq("household_id", ctx.household.id)
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  const avatars = await signedAvatarMap(ctx.supabase, (data ?? []).map((s) => s.kids?.avatar_path));
  return ok({
    currency: ctx.household.currency,
    locale: ctx.locale,
    items: (data ?? []).map((s) => ({
      id: s.id,
      kid: {
        id: s.kid_id,
        name: s.kids?.name ?? "?",
        color: s.kids?.color ?? "#E08A1E",
        avatarUrl: s.kids?.avatar_path ? (avatars[s.kids.avatar_path] ?? null) : null,
      },
      // The chore's current name (linked); the snapshot is only a fallback.
      chore: { id: s.chore_id, title: s.chores?.title ?? s.chore_title_snapshot, emoji: s.chores?.emoji ?? null },
      quantity: s.quantity,
      unitLabel: s.chores?.unit_label ?? null,
      unitPriceCents: s.unit_price_cents,
      amountCents: s.amount_cents,
      // Plain ISO 8601 with milliseconds and Z: every phone date parser reads it.
      submittedAt: new Date(s.submitted_at).toISOString(),
      resubmitted: Boolean(s.resubmitted_at),
      kidNote: null,
      photoUrl: null,
    })),
  });
}
