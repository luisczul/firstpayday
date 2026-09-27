import { NextResponse } from "next/server";
import { z } from "zod";
import { kioskRoute } from "@/lib/kiosk/route";
import { toggleSubtask } from "@/lib/kiosk/operations";
import { SUBTASK_ID } from "@/lib/schedule/checklist";

const Body = z.object({
  kidId: z.uuid(),
  choreId: z.uuid(),
  subtaskId: z.string().regex(SUBTASK_ID),
  checked: z.boolean(),
});

/** Tick / untick one step of a checklist chore (kiosk whitelist #6). */
export function POST(req: Request) {
  return kioskRoute(async (ctx) => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    const result = await toggleSubtask(ctx, parsed.data);
    return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "error" ? 500 : 400 });
  });
}
