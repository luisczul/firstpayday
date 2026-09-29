import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_MODE_COOKIE, adminModeActive, adminModeCookieOptionsFor, readAdminMode, signAdminMode } from "@/lib/auth/adminMode";
import { getUser } from "@/lib/auth/session";

/** Renews Admin Mode on parent activity; returns the new deadline. */
export async function POST() {
  const { user } = await getUser();
  const store = await cookies();
  const claim = await readAdminMode(store.get(ADMIN_MODE_COOKIE)?.value);
  if (!user || !claim || !adminModeActive(claim, user.id)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const value = await signAdminMode(user.id, claim.timeoutMinutes);
  store.set(ADMIN_MODE_COOKIE, value, adminModeCookieOptionsFor(claim.timeoutMinutes));
  return NextResponse.json({ ok: true, until: Date.now() + claim.timeoutMinutes * 60_000 });
}
