import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_TIP_CENTS, tipTooBig } from "@/lib/approvals/errors";
import { appMessage, appParent, body, fail, ok } from "@/lib/app/api";
import { reviewFailure } from "@/lib/app/review";
import { trackActivity } from "@/lib/slack/activity";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await appParent(req);
  if (ctx instanceof NextResponse) return ctx;
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return fail("not_found", appMessage(req, "notFound"), 404);
  const b = (await body(req)) ?? {};
  const bonus = z.number().int().min(0).max(MAX_TIP_CENTS).optional().safeParse(b.bonusCents ?? undefined);
  if (!bonus.success) return fail("invalid", tipTooBig(ctx).message, 400);
  if (ctx.access !== "full") return reviewFailure(ctx, "read-only");
  const { error } = await ctx.supabase.rpc("approve_submission", { p_submission_id: id.data, p_bonus_cents: bonus.data });
  if (error) return reviewFailure(ctx, error.message);
  trackActivity({ kind: "approved", householdId: ctx.household.id, submissionId: id.data });
  return ok({ ok: true });
}

