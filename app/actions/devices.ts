"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, getParentContext, runAction } from "@/lib/auth/session";
import { PLAN_LIMITS, withinLimit } from "@/lib/billing/plans";
import { registerKioskDevice, clearKioskCookie } from "@/lib/kiosk/auth";
import { ADMIN_MODE_COOKIE } from "@/lib/auth/adminMode";

/**
 * "Use this device as the kids' tablet" (SPEC §7): register the device,
 * set the kiosk cookie, sign the parent out, land on the kid picker.
 * Allowed in read-only mode too: kids can still see balances.
 */
export async function enableKioskOnThisDevice(name?: string) {
  const result = await runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw new ActionError("forbidden", "Please log in again.");
    const { count } = await ctx.supabase
      .from("devices")
      .select("id", { count: "exact", head: true })
      .eq("household_id", ctx.household.id)
      .is("revoked_at", null);
    if (!withinLimit(ctx.plan, "devices", count ?? 0)) {
      throw new ActionError(
        "limit",
        `Your plan includes ${PLAN_LIMITS[ctx.plan].devices} tablets. Revoke an old one or upgrade.`,
      );
    }
    await clearKioskCookie();
    await registerKioskDevice({
      householdId: ctx.household.id,
      userId: ctx.user.id,
      name: z.string().trim().min(1).max(60).catch("Kitchen tablet").parse(name ?? "Kitchen tablet"),
    });
    await ctx.supabase.auth.signOut();
    (await cookies()).delete(ADMIN_MODE_COOKIE);
  });
  if (result.ok) redirect("/kids");
  return result;
}

export async function revokeDevice(deviceId: string) {
  return runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw new ActionError("forbidden", "Please log in again.");
    const { error } = await ctx.supabase
      .from("devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(deviceId));
    if (error) throw error;
    revalidatePath("/admin/settings/devices");
  });
}

export async function renameDevice(deviceId: string, name: string) {
  return runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw new ActionError("forbidden", "Please log in again.");
    const { error } = await ctx.supabase
      .from("devices")
      .update({ name: z.string().trim().min(1).max(60).parse(name) })
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(deviceId));
    if (error) throw error;
    revalidatePath("/admin/settings/devices");
  });
}
