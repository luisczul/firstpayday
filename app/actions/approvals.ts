"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction } from "@/lib/auth/session";

function friendly(message: string): ActionError {
  if (message.includes("read-only")) return new ActionError("read_only", "Your board is read-only. Upgrade to approve chores.");
  if (message.includes("quantity")) return new ActionError("invalid", "That quantity isn't allowed for this chore.");
  if (message.includes("not found")) return new ActionError("not_found", "That submission is gone.");
  return new ActionError("invalid", "That submission was already reviewed.");
}

function revalidate() {
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/kids", "layout");
}

export async function approveSubmission(submissionId: string, quantity?: number, comment?: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const { error } = await ctx.supabase.rpc("approve_submission", {
      p_submission_id: z.uuid().parse(submissionId),
      p_quantity: quantity === undefined ? undefined : z.number().int().min(1).max(20).parse(quantity),
      p_comment: comment?.slice(0, 300),
    });
    if (error) throw friendly(error.message);
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
      if (e) throw friendly(e.message);
    }
    revalidate();
    return { approved: pending.length };
  });
}

export async function sendBackSubmission(submissionId: string, comment: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const text = z.string().trim().min(1, "Add a comment for your kid.").max(300).safeParse(comment);
    if (!text.success) throw new ActionError("invalid", text.error.issues[0]!.message);
    const { error } = await ctx.supabase.rpc("send_back_submission", {
      p_submission_id: z.uuid().parse(submissionId),
      p_comment: text.data,
    });
    if (error) throw friendly(error.message);
    revalidate();
  });
}

export async function rejectSubmission(submissionId: string, reason: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const text = z.string().trim().min(1, "Add a reason.").max(300).safeParse(reason);
    if (!text.success) throw new ActionError("invalid", text.error.issues[0]!.message);
    const { error } = await ctx.supabase.rpc("reject_submission", {
      p_submission_id: z.uuid().parse(submissionId),
      p_reason: text.data,
    });
    if (error) throw friendly(error.message);
    revalidate();
  });
}
