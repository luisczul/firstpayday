import { NextResponse } from "next/server";
import { z } from "zod";
import { kioskRoute } from "@/lib/kiosk/route";
import { withdraw } from "@/lib/kiosk/operations";

const Body = z.object({ kidId: z.uuid(), submissionId: z.uuid() });

/** A kid gives up a sent-back chore ("too hard for me"). */
export function POST(req: Request) {
  return kioskRoute(async (ctx) => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    const result = await withdraw(ctx, parsed.data);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  });
}
