import { NextResponse } from "next/server";
import { z } from "zod";
import { kioskRoute } from "@/lib/kiosk/route";
import { claimChore } from "@/lib/kiosk/operations";

const Body = z.object({ kidId: z.uuid(), choreId: z.uuid(), quantity: z.number().int().min(1).max(20).default(1) });

/** "I'm on it!": a kid saves a whole-house chore for themselves. */
export function POST(req: Request) {
  return kioskRoute(async (ctx) => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    const result = await claimChore(ctx, parsed.data);
    return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "claimed" || result.reason === "taken" ? 409 : 400 });
  });
}
