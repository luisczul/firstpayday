import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { kioskRoute } from "@/lib/kiosk/route";
import { getBoard } from "@/lib/kiosk/operations";

export const dynamic = "force-dynamic";

const Query = z.object({
  kidId: z.uuid(),
  markSeen: z.enum(["0", "1"]).optional(),
  seenBefore: z.iso.datetime({ offset: true }).optional(),
});

export function GET(req: NextRequest) {
  return kioskRoute(async (ctx) => {
    const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const board = await getBoard(ctx, parsed.data.kidId, {
      markSeen: parsed.data.markSeen === "1",
      seenBefore: parsed.data.seenBefore ?? null,
    });
    if (!board) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(board);
  });
}
