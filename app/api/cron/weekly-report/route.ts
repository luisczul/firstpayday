import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { safeEqual } from "@/lib/crypto";
import { previewWeeklyReportHtml, runWeeklyReports } from "@/lib/reports/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hourly (vercel.json cron): send the weekly parent report to households whose
 * chosen local day/hour is now. Vercel sends `Authorization: Bearer CRON_SECRET`.
 *
 * GET ?preview=<householdId> returns the email HTML without sending it: open in
 * development, and in production only with the same Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const authorized = Boolean(secret) && safeEqual(auth, `Bearer ${secret}`);

  // new URL(req.url), not req.nextUrl: the query survives the middleware hand-off in production builds.
  const preview = new URL(req.url).searchParams.get("preview");
  if (preview !== null && (authorized || process.env.NODE_ENV !== "production")) {
    if (!z.uuid().safeParse(preview).success) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const html = await previewWeeklyReportHtml(preview);
    if (!html) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ skipped: "no RESEND_API_KEY" });

  return NextResponse.json(await runWeeklyReports());
}
