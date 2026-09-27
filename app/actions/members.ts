"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, getParentContext, runAction } from "@/lib/auth/session";
import { LIMITS, withinLimit } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { appSecret, hashPin, randomToken, sha256Hex } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { emailLayout, sendEmail } from "@/lib/email/send";
import { brand } from "@/lib/brand";
import { parentT } from "@/lib/i18n/parent";
import { inviteEmail } from "@/lib/email/parentEmails";

async function ownerCtx() {
  const ctx = await getParentContext();
  if (!ctx) throw new ActionError("forbidden", "Please log in again.");
  const t = parentT(ctx.locale);
  if (!ctx.isOwner) throw new ActionError("forbidden", t("b.err.ownerOnlyMembers"));
  if (ctx.access !== "full") throw new ActionError("read_only", t("b.err.readOnlyInvite"));
  return ctx;
}

export async function inviteMember(input: { email: string; role: "owner" | "parent" }) {
  return runAction(async () => {
    const ctx = await ownerCtx();
    const t = parentT(ctx.locale);
    const email = z.email().safeParse(input.email.trim().toLowerCase());
    if (!email.success) throw new ActionError("invalid", t("b.err.validEmail"));
    const role = z.enum(["owner", "parent"]).parse(input.role);

    const admin = createAdminClient();
    const [{ count: members }, { count: invites }] = await Promise.all([
      admin.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", ctx.household.id),
      admin
        .from("household_invites")
        .select("id", { count: "exact", head: true })
        .eq("household_id", ctx.household.id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString()),
    ]);
    if (!withinLimit("parents", (members ?? 0) + (invites ?? 0))) {
      throw new ActionError("limit", t("b.err.parentLimit", { n: LIMITS.parents }));
    }

    const token = randomToken(24);
    const { error } = await admin.from("household_invites").insert({
      household_id: ctx.household.id,
      email: email.data,
      role,
      token_hash: await sha256Hex(token),
      invited_by: ctx.user.id,
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });
    if (error) throw error;

    const link = `${appUrl()}/invite/${token}`;
    const mail = inviteEmail({ locale: ctx.locale, home: ctx.household.name, inviter: ctx.user.email, brand: brand.name, link });
    const sent = await sendEmail({ to: email.data, subject: mail.subject, html: emailLayout(mail.title, mail.body) });
    revalidatePath("/admin/settings/members");
    return { link, emailed: sent };
  });
}

export async function cancelInvite(inviteId: string) {
  return runAction(async () => {
    const ctx = await ownerCtx();
    const { error } = await ctx.supabase
      .from("household_invites")
      .delete()
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(inviteId));
    if (error) throw error;
    revalidatePath("/admin/settings/members");
  });
}

export async function removeMember(userId: string) {
  return runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw new ActionError("forbidden", "Please log in again.");
    const id = z.uuid().parse(userId);
    const t = parentT(ctx.locale);
    if (id !== ctx.user.id && !ctx.isOwner) throw new ActionError("forbidden", t("b.err.ownerOnlyRemove"));
    const { data: owners } = await ctx.supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", ctx.household.id)
      .eq("role", "owner");
    if (owners?.length === 1 && owners[0]!.user_id === id) {
      throw new ActionError("invalid", t("b.err.lastOwner"));
    }
    const { error } = await ctx.supabase
      .from("household_members")
      .delete()
      .eq("household_id", ctx.household.id)
      .eq("user_id", id);
    if (error) throw error;
    revalidatePath("/admin/settings/members");
  });
}

/** Per-member parent PIN (SPEC §7). Empty pin clears it. */
export async function setMyPin(pin: string) {
  return runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw new ActionError("forbidden", "Please log in again.");
    let pinHash: string | null = null;
    if (pin) {
      if (!/^\d{4,6}$/.test(pin)) throw new ActionError("invalid", parentT(ctx.locale)("b.err.pinDigits"));
      pinHash = await hashPin(pin, randomToken(8), await appSecret("ADMIN_MODE_SECRET"));
    }
    // Service role: pin_hash is not something the member's own session should read back.
    const { error } = await createAdminClient()
      .from("household_members")
      .update({ pin_hash: pinHash, pin_failed_attempts: 0, pin_locked_until: null })
      .eq("household_id", ctx.household.id)
      .eq("user_id", ctx.user.id);
    if (error) throw error;
    revalidatePath("/admin/settings");
  });
}

export async function setMyDisplayName(name: string) {
  return runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw new ActionError("forbidden", "Please log in again.");
    const { error } = await ctx.supabase
      .from("household_members")
      .update({ display_name: z.string().trim().max(40).parse(name) || null })
      .eq("household_id", ctx.household.id)
      .eq("user_id", ctx.user.id);
    if (error) throw error;
    revalidatePath("/admin/settings");
  });
}

/** "Email me when a chore is ready for review" (own row only; column-level grant). */
export async function setMyReviewEmails(enabled: boolean) {
  return runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw new ActionError("forbidden", "Please log in again.");
    const { error } = await ctx.supabase
      .from("household_members")
      .update({ review_emails_enabled: z.boolean().parse(enabled) })
      .eq("household_id", ctx.household.id)
      .eq("user_id", ctx.user.id);
    if (error) throw error;
    revalidatePath("/admin/settings");
  });
}

/** Per-parent opt-out of the weekly report email (default on). */
export async function setMyWeeklyReport(enabled: boolean) {
  return runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw new ActionError("forbidden", "Please log in again.");
    const { error } = await ctx.supabase
      .from("household_members")
      .update({ weekly_report_enabled: z.boolean().parse(enabled) })
      .eq("household_id", ctx.household.id)
      .eq("user_id", ctx.user.id);
    if (error) throw error;
    revalidatePath("/admin/settings");
  });
}
