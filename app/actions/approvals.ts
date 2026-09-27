"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction, type ParentContext } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { formatMoney } from "@/lib/money/format";

const MAX_TIP_CENTS = 10_000;

function tipTooBig(ctx: ParentContext): ActionError {
  const max = formatMoney(MAX_TIP_CENTS, ctx.household.currency, ctx.locale);
  return new ActionError("invalid", parentT(ctx.locale)("a.err.tipMax", { max }));
}

function friendly(ctx: ParentContext, message: string): ActionError {
  const t = parentT(ctx.locale);
  if (message.includes("read-only")) return new ActionError("read_only", t("a.err.readOnlyApprove"));
  if (message.includes("bonus")) return tipTooBig(ctx);
  if (message.includes("quantity")) return new ActionError("invalid", t("a.err.quantity"));
  if (message.includes("not found")) return new ActionError("not_found", t("a.err.submissionGone"));
  return new ActionError("invalid", t("a.err.alreadyReviewed"));
}

function revalidate() {
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/kids", "layout");
}

export async function approveSubmission(submissionId: string, quantity?: number, comment?: string, bonusCents?: number) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const bonus = z.number().int().min(0).max(MAX_TIP_CENTS).optional().safeParse(bonusCents);
    if (!bonus.success) throw tipTooBig(ctx);
    const { error } = await ctx.supabase.rpc("approve_submission", {
      p_submission_id: z.uuid().parse(submissionId),
      p_quantity: quantity === undefined ? undefined : z.number().int().min(1).max(20).parse(quantity),
      p_comment: comment?.slice(0, 300),
      // Optional "great job" tip, paid as its own ledger row (max $100).
      p_bonus_cents: bonus.data,
    });
    if (error) throw friendly(ctx, error.message);
    revalidate();
  });
}

/** "Approve all" for one kid (confirmed in the page first). */
export async function approveAllForKid(kidId: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const { data: pending, error } = await ctx.supabase
      .from("submissions")
      .select("id")
      .eq("household_id", ctx.household.id)
      .eq("kid_id", z.uuid().parse(kidId))
      .eq("status", "pending");
    if (error) throw error;
    for (const s of pending) {
      const { error: e } = await ctx.supabase.rpc("approve_submission", { p_submission_id: s.id });
      if (e) throw friendly(ctx, e.message);
    }
    revalidate();
    return { approved: pending.length };
  });
}

export async function sendBackSubmission(submissionId: string, comment: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const text = z.string().trim().min(1).max(300).safeParse(comment);
    if (!text.success) throw new ActionError("invalid", parentT(ctx.locale)(text.error.issues[0]?.code === "too_small" ? "a.err.commentForKid" : "a.common.checkForm"));
    const { error } = await ctx.supabase.rpc("send_back_submission", {
      p_submission_id: z.uuid().parse(submissionId),
      p_comment: text.data,
    });
    if (error) throw friendly(ctx, error.message);
    revalidate();
  });
}

export async function rejectSubmission(submissionId: string, reason: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const text = z.string().trim().min(1).max(300).safeParse(reason);
    if (!text.success) throw new ActionError("invalid", parentT(ctx.locale)(text.error.issues[0]?.code === "too_small" ? "a.err.reason" : "a.common.checkForm"));
    const { error } = await ctx.supabase.rpc("reject_submission", {
      p_submission_id: z.uuid().parse(submissionId),
      p_reason: text.data,
    });
    if (error) throw friendly(ctx, error.message);
    revalidate();
  });
}

/**
 * Undo an approval after double-checking: the money comes back out (as an
 * adjustment, the ledger never changes), and the chore either goes back to
 * the kid as a revision with a comment, or is reversed for good.
 */
export async function reopenSubmission(submissionId: string, comment: string, mode: "revision" | "reverse") {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const text = z.string().trim().min(1).max(300).safeParse(comment);
    if (!text.success) throw new ActionError("invalid", parentT(ctx.locale)(text.error.issues[0]?.code === "too_small" ? "a.err.noteForKid" : "a.common.checkForm"));
    const { error } = await ctx.supabase.rpc("reopen_submission", {
      p_submission_id: z.uuid().parse(submissionId),
      p_comment: text.data,
      p_mode: z.enum(["revision", "reverse"]).parse(mode),
    });
    if (error) throw friendly(ctx, error.message);
    revalidate();
  });
}
