import { NextResponse } from "next/server";
import { KIOSK_COOKIE } from "@/lib/auth/adminMode";

/** Home-screen icon entry point: the kids' board on a kids' tablet, the parent admin everywhere else. */
export function GET(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const onKiosk = cookie.split(/;\s*/).some((c) => c.startsWith(`${KIOSK_COOKIE}=`) && c.length > KIOSK_COOKIE.length + 1);
  return NextResponse.redirect(new URL(onKiosk ? "/kids" : "/admin", req.url), 307);
}
