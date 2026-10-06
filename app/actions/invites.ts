"use server";

import { redirect } from "next/navigation";
import { ActionError, getUser, runAction } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/crypto";
import { getHouseholdAccess } from "@/lib/billing/access";
import { LIMITS, withinLimit } from "@/lib/billing/plans";
import { asLocale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";
import { trackActivity } from "@/lib/slack/activity";

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
    // The invited parent reads errors in the inviting household's language.
    const { data: home } = invite
      ? await admin.from("households").select("locale").eq("id", invite.household_id).maybeSingle()
      : { data: null };
    const t = parentT(asLocale(home?.locale));
    if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
      throw new ActionError("not_found", t("b.err.inviteExpired"));
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ActionError("forbidden", t("b.err.inviteOtherEmail"));
    }
    const [{ count }, { data: sub }, { count: kids }] = await Promise.all([
      admin.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", invite.household_id),
      admin.from("subscriptions").select("*").eq("household_id", invite.household_id).maybeSingle(),
      admin.from("kids").select("id", { count: "exact", head: true }).eq("household_id", invite.household_id).is("archived_at", null),
    ]);
    if (getHouseholdAccess(sub, new Date(), kids ?? 0) !== "full" || !withinLimit("parents", count ?? 0)) {
      throw new ActionError("limit", t("b.err.inviteLimit", { n: LIMITS.parents }));
    }
    const { error } = await admin
      .from("household_members")
      .upsert({ household_id: invite.household_id, user_id: user.id, role: invite.role }, { onConflict: "household_id,user_id" });
    if (error) throw error;
    await admin.from("household_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    trackActivity({ kind: "parent_joined", householdId: invite.household_id, email: user.email });
  });
  if (result.ok) redirect("/admin");
  return result;
}
