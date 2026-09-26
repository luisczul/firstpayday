"use server";

import { redirect } from "next/navigation";
import { ActionError, getUser, runAction } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/crypto";
import { getHouseholdAccess } from "@/lib/billing/access";
import { LIMITS, withinLimit } from "@/lib/billing/plans";

export async function acceptInvite(token: string) {
  const result = await runAction(async () => {
    const { user } = await getUser();
    if (!user?.email) throw new ActionError("forbidden", "Please log in first.");
    const admin = createAdminClient();
    const { data: invite } = await admin
      .from("household_invites")
      .select("*")
      .eq("token_hash", await sha256Hex(String(token)))
      .maybeSingle();
    if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
      throw new ActionError("not_found", "This invite has expired.");
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ActionError("forbidden", "This invite is for a different email.");
    }
    const [{ count }, { data: sub }, { count: kids }] = await Promise.all([
      admin.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", invite.household_id),
      admin.from("subscriptions").select("*").eq("household_id", invite.household_id).maybeSingle(),
      admin.from("kids").select("id", { count: "exact", head: true }).eq("household_id", invite.household_id).is("archived_at", null),
    ]);
    if (getHouseholdAccess(sub, new Date(), kids ?? 0) !== "full" || !withinLimit("parents", count ?? 0)) {
      throw new ActionError("limit", `This household can't add parents right now (limit ${LIMITS.parents}). Ask the owner.`);
    }
    const { error } = await admin
      .from("household_members")
      .upsert({ household_id: invite.household_id, user_id: user.id, role: invite.role }, { onConflict: "household_id,user_id" });
    if (error) throw error;
    await admin.from("household_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  });
  if (result.ok) redirect("/admin");
  return result;
}
