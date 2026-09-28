import { NextResponse } from "next/server";
import { signedAvatarMap } from "@/lib/avatars";
import { appParent, ok } from "@/lib/app/api";

export async function GET(req: Request) {
  const ctx = await appParent(req);
  if (ctx instanceof NextResponse) return ctx;
  const [{ data: kids, error }, { data: balances }] = await Promise.all([
    ctx.supabase.from("kids").select("id, name, color, avatar_path").eq("household_id", ctx.household.id).is("archived_at", null).order("sort_order"),
    ctx.supabase.from("kid_balances").select("kid_id, balance_cents, pending_cents").eq("household_id", ctx.household.id),
  ]);
  if (error) throw error;
  const avatars = await signedAvatarMap(ctx.supabase, (kids ?? []).map((k) => k.avatar_path));
  const bal = new Map((balances ?? []).map((b) => [b.kid_id, b]));
  return ok({
    currency: ctx.household.currency,
    locale: ctx.locale,
    items: (kids ?? []).map((k) => ({
      id: k.id,
      name: k.name,
      color: k.color,
      avatarUrl: k.avatar_path ? (avatars[k.avatar_path] ?? null) : null,
      balanceCents: bal.get(k.id)?.balance_cents ?? 0,
      pendingCents: bal.get(k.id)?.pending_cents ?? 0,
    })),
  });
}
