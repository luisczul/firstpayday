import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_MODE_COOKIE,
  ADMIN_MODE_STAY,
  KIOSK_COOKIE,
  adminModeActive,
  adminModeCookieOptionsFor,
  readAdminMode,
  signAdminMode,
} from "@/lib/auth/adminMode";
import { getParentContext } from "@/lib/auth/session";

/**
 * On a kids' tablet in parent mode: { stay: true } keeps parent mode on (no inactivity timeout)
 * until "Back to Kids Mode"; { stay: false } turns the household's timer back on.
 */
export async function POST(req: Request) {
  const ctx = await getParentContext();
  const store = await cookies();
  const claim = await readAdminMode(store.get(ADMIN_MODE_COOKIE)?.value);
  if (!ctx || !store.get(KIOSK_COOKIE)?.value || !adminModeActive(claim, ctx.user.id)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { stay?: unknown } | null;
  const minutes = body?.stay === true ? ADMIN_MODE_STAY : (ctx.household.admin_timeout_minutes ?? 30);
  store.set(ADMIN_MODE_COOKIE, await signAdminMode(ctx.user.id, minutes), adminModeCookieOptionsFor(minutes));
  return NextResponse.json({ ok: true, timeoutMinutes: minutes, until: Date.now() + minutes * 60_000 });
}
