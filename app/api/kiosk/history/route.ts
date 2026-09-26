import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { kioskRoute } from "@/lib/kiosk/route";
import { getKidHistory } from "@/lib/kiosk/operations";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return kioskRoute(async (ctx) => {
    const kidId = z.uuid().safeParse(req.nextUrl.searchParams.get("kidId"));
    if (!kidId.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
    return NextResponse.json({ items: await getKidHistory(ctx, kidId.data) });
  });
}
