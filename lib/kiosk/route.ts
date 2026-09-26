import "server-only";
import { NextResponse } from "next/server";
import { KioskAuthError, refreshKioskCookie, requireKiosk, type KioskContext } from "./auth";

/** Wrap a kiosk route: resolve the device, map auth failures to 401. */
export async function kioskRoute(handler: (ctx: KioskContext) => Promise<Response>): Promise<Response> {
  try {
    const ctx = await requireKiosk();
    await refreshKioskCookie();
    const res = await handler(ctx);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    if (e instanceof KioskAuthError) {
      return NextResponse.json({ error: e.status === "revoked" ? "revoked" : "no_device" }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
