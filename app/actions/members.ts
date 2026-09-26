"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, getParentContext, runAction } from "@/lib/auth/session";
import { PLAN_LIMITS, withinLimit } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { appSecret, hashPin, randomToken, sha256Hex } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { emailLayout, sendEmail } from "@/lib/email/send";
import { brand } from "@/lib/brand";

async function ownerCtx() {
  const ctx = await getParentContext();
  if (!ctx) throw new ActionError("forbidden", "Please log in again.");
  if (!ctx.isOwner) throw new ActionError("forbidden", "Only the household owner can manage members.");
  if (ctx.access !== "full") throw new ActionError("read_only", "Your board is read-only. Upgrade to invite parents.");
  return ctx;
}

export async function inviteMember(input: { email: string; role: "owner" | "parent" }) {
  return runAction(async () => {
    const ctx = await ownerCtx();
    const email = z.email("Enter a valid email.").safeParse(input.email.trim().toLowerCase());
    if (!email.success) throw new ActionError("invalid", "Enter a valid email.");
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
    if (!withinLimit(ctx.plan, "parents", (members ?? 0) + (invites ?? 0))) {
      throw new ActionError("limit", `Your plan includes ${PLAN_LIMITS[ctx.plan].parents} parents. Upgrade to add more.`);
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
    const sent = await sendEmail({
      to: email.data,
      subject: `You're invited to ${ctx.household.name} on ${brand.name}`,
      html: emailLayout(
        `Join ${ctx.household.name}`,
        `<p>${ctx.user.email} invited you to help run the chore board.</p>
         <p><a href="${link}" style="display:inline-block;background:#B8431F;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:800">Accept invite</a></p>
         <p style="font-size:13px;color:#7A5A48">This link expires in 7 days.</p>`,
      ),
    });
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
    if (id !== ctx.user.id && !ctx.isOwner) throw new ActionError("forbidden", "Only the owner can remove parents.");
    const { data: owners } = await ctx.supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", ctx.household.id)
      .eq("role", "owner");
    if (owners?.length === 1 && owners[0]!.user_id === id) {
      throw new ActionError("invalid", "The last owner can't be removed. Make someone else an owner first.");
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
      if (!/^\d{4,6}$/.test(pin)) throw new ActionError("invalid", "Use 4 to 6 digits.");
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
