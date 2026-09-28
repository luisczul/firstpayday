import { NextResponse } from "next/server";
import { z } from "zod";
import { parentT } from "@/lib/i18n/parent";
import { appMessage, appParent, body, fail, ok } from "@/lib/app/api";
import { reviewFailure } from "@/lib/app/review";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await appParent(req);
  if (ctx instanceof NextResponse) return ctx;
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return fail("not_found", appMessage(req, "notFound"), 404);
  const text = z.string().trim().min(1).max(500).safeParse((await body(req))?.comment);
  if (!text.success) return fail("invalid", parentT(ctx.locale)("a.err.commentForKid"), 400);
  if (ctx.access !== "full") return reviewFailure(ctx, "read-only");
  const { error } = await ctx.supabase.rpc("send_back_submission", { p_submission_id: id.data, p_comment: text.data });
  if (error) return reviewFailure(ctx, error.message);
  return ok({ ok: true });
}
