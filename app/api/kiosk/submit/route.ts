import { NextResponse } from "next/server";
import { z } from "zod";
import { kioskRoute } from "@/lib/kiosk/route";
import { createSubmission } from "@/lib/kiosk/operations";

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
    return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "taken" ? 409 : 400 });
  });
}
