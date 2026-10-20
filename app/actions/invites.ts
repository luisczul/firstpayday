"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, getUser, runAction } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/crypto";
import { getHouseholdAccess } from "@/lib/billing/access";
import { LIMITS, withinLimit } from "@/lib/billing/plans";
import { asLocale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";
import { trackActivity } from "@/lib/slack/activity";

type InviteRow = { id: string; household_id: string; email: string; role: string; expires_at: string; accepted_at: string | null };

/** Joins the signed-in parent to the invite's home (checks: not used, not expired, same email, room left). */
async function join(invite: InviteRow | null, user: { id: string; email?: string }) {
  const admin = createAdminClient();
  // The invited parent reads errors in the inviting household's language.
  const { data: home } = invite
    ? await admin.from("households").select("locale").eq("id", invite.household_id).maybeSingle()
    : { data: null };
  const t = parentT(asLocale(home?.locale));
  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    throw new ActionError("not_found", t("b.err.inviteExpired"));
  }
  if (!user.email || invite.email.toLowerCase() !== user.email.toLowerCase()) {
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
}

export async function acceptInvite(token: string) {
  const result = await runAction(async () => {
    const { user } = await getUser();
    if (!user?.email) throw new ActionError("forbidden", "Please log in first.");
    const { data: invite } = await createAdminClient()
      .from("household_invites")
      .select("id, household_id, email, role, expires_at, accepted_at")
      .eq("token_hash", await sha256Hex(String(token)))
      .maybeSingle();
    await join(invite, user);
  });
  if (result.ok) redirect("/admin");
  return result;
}

/**
 * The invited parent signed up without the email's link (e.g. in the app): onboarding offers the
 * invites waiting for their email, and this joins one of them by id.
 */
export async function acceptInviteById(inviteId: string) {
  const result = await runAction(async () => {
    const { user } = await getUser();
    if (!user?.email) throw new ActionError("forbidden", "Please log in first.");
    const id = z.uuid().safeParse(inviteId);
    const { data: invite } = id.success
      ? await createAdminClient().from("household_invites").select("id, household_id, email, role, expires_at, accepted_at").eq("id", id.data).maybeSingle()
      : { data: null };
    await join(invite, user);
  });
  if (result.ok) redirect("/admin");
  return result;
}
