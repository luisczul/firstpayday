import { NextResponse, after } from "next/server";
import { z } from "zod";
import { kioskRoute } from "@/lib/kiosk/route";
import { resubmit } from "@/lib/kiosk/operations";
import { notifyReviewReady } from "@/lib/email/reviewNotify";
import { notifyNewSubmissionPush } from "@/lib/push/notify";

const Body = z.object({ kidId: z.uuid(), submissionId: z.uuid() });

export function POST(req: Request) {
  return kioskRoute(async (ctx) => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    const result = await resubmit(ctx, parsed.data);
    // Email parents after the kid has their answer (skips auto-approved, throttled per parent).
    if (result.ok) {
      const { submissionId } = result;
      after(() => notifyReviewReady(ctx.householdId, submissionId));
      after(() => notifyNewSubmissionPush(ctx.householdId, submissionId));
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  });
}
