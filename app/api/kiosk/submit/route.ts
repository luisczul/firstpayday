import { NextResponse, after } from "next/server";
import { z } from "zod";
import { kioskRoute } from "@/lib/kiosk/route";
import { createSubmission } from "@/lib/kiosk/operations";
import { notifyReviewReady } from "@/lib/email/reviewNotify";

const Body = z.object({
  kidId: z.uuid(),
  choreId: z.uuid(),
  quantity: z.number().int().min(1).max(20),
  idempotencyKey: z.string().min(8).max(100),
  expectedLastId: z.uuid().nullable(),
});

export function POST(req: Request) {
  return kioskRoute(async (ctx) => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    const result = await createSubmission(ctx, parsed.data);
    // Email parents after the kid has their answer (skips auto-approved, throttled per parent).
    if (result.ok) {
      const { submissionId } = result;
      after(() => notifyReviewReady(ctx.householdId, submissionId));
    }
    return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "taken" || result.reason === "claimed" ? 409 : 400 });
  });
}
