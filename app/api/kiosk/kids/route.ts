import { NextResponse } from "next/server";
import { kioskRoute } from "@/lib/kiosk/route";
import { listKids } from "@/lib/kiosk/operations";

export const dynamic = "force-dynamic";

export function GET() {
  return kioskRoute(async (ctx) => NextResponse.json(await listKids(ctx)));
}
