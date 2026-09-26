import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_MODE_COOKIE, adminModeCookieOptions, readAdminMode, signAdminMode } from "@/lib/auth/adminMode";
import { getUser } from "@/lib/auth/session";

/** Renews Admin Mode on parent activity; returns the new deadline. */
export async function POST() {
  const { user } = await getUser();
  const store = await cookies();
  const claim = await readAdminMode(store.get(ADMIN_MODE_COOKIE)?.value);
  if (!user || !claim || claim.userId !== user.id || claim.until <= Date.now()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const value = await signAdminMode(user.id, claim.timeoutMinutes);
  store.set(ADMIN_MODE_COOKIE, value, adminModeCookieOptions);
  return NextResponse.json({ ok: true, until: Date.now() + claim.timeoutMinutes * 60_000 });
}
