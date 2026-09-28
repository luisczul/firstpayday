import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadParentContext } from "@/lib/auth/session";
import { appUser, ok } from "@/lib/app/api";

export async function GET(req: Request) {
  const user = await appUser(req);
  if (user instanceof NextResponse) return user;
  const [ctx, { data: admin }] = await Promise.all([
    loadParentContext(user.supabase, user),
    createAdminClient().from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const base = { user: { id: user.id, email: user.email }, platformAdmin: Boolean(admin) };
  if (!ctx) return ok({ ...base, household: null, access: "full", pendingCount: 0 });
  const { count } = await ctx.supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("household_id", ctx.household.id)
    .eq("status", "pending");
  const h = ctx.household;
  return ok({
    ...base,
    household: { id: h.id, name: h.name, currency: h.currency, locale: ctx.locale, timezone: h.timezone },
    access: ctx.access === "full" ? "full" : "read_only",
    pendingCount: count ?? 0,
  });
}
