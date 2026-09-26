import { NextResponse, type NextRequest } from "next/server";
import { getParentContext } from "@/lib/auth/session";
import { loadHistory, toCsv, type HistoryFilters } from "@/lib/history";
import { PLAN_LIMITS } from "@/lib/billing/plans";

export async function GET(req: NextRequest) {
  const ctx = await getParentContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // CSV export is a Family Plus feature, but a lapsed household can always take its data.
  if (!PLAN_LIMITS[ctx.plan].csvExport && ctx.access === "full") {
    return NextResponse.json({ error: "CSV export is part of Family Plus." }, { status: 402 });
  }
  const p = req.nextUrl.searchParams;
  const filters: HistoryFilters = {
    kid: p.get("kid") || undefined,
    chore: p.get("chore") || undefined,
    type: (p.get("type") as HistoryFilters["type"]) || "all",
    from: p.get("from") || undefined,
    to: p.get("to") || undefined,
  };
  const csv = toCsv(await loadHistory(ctx, filters, 10_000));
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="chore-board-history-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
