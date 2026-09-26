import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { appSecret, hmacHex, randomToken } from "@/lib/crypto";
import { KIOSK_COOKIE } from "@/lib/auth/adminMode";

// Kiosk (kitchen tablet) identity, SPEC §7. The raw token only ever lives in
// the httpOnly cookie; the database stores HMAC(KIOSK_COOKIE_SECRET, token).

const ONE_YEAR = 60 * 60 * 24 * 365;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ONE_YEAR,
};

export interface KioskContext {
  deviceId: string;
  householdId: string;
}

export type KioskResolution =
  | { status: "ok"; ctx: KioskContext }
  | { status: "none" }
  | { status: "revoked" };

async function tokenHash(token: string): Promise<string> {
  return hmacHex(await appSecret("KIOSK_COOKIE_SECRET"), token);
}

/** Resolve the tablet's household from its cookie. Cached per request. */
export const resolveKiosk = cache(async (): Promise<KioskResolution> => {
  const token = (await cookies()).get(KIOSK_COOKIE)?.value;
  if (!token) return { status: "none" };

  const admin = createAdminClient();
  const { data: device } = await admin
    .from("devices")
    .select("id, household_id, revoked_at, last_seen_at")
    .eq("token_hash", await tokenHash(token))
    .maybeSingle();
  if (!device) return { status: "revoked" };
  if (device.revoked_at) return { status: "revoked" };

  // Touch last_seen at most every 5 minutes.
  const last = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
  if (Date.now() - last > 5 * 60_000) {
    await admin.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
  }
  return { status: "ok", ctx: { deviceId: device.id, householdId: device.household_id } };
});

/** Throws unless the request comes from a valid, non-revoked kiosk. */
export async function requireKiosk(): Promise<KioskContext> {
  const r = await resolveKiosk();
  if (r.status !== "ok") throw new KioskAuthError(r.status);
  return r.ctx;
}

export class KioskAuthError extends Error {
  constructor(public status: "none" | "revoked") {
    super(`kiosk ${status}`);
  }
}

/**
 * Register this browser as a kiosk for a household. The caller must have
 * verified membership and plan limits already.
 */
export async function registerKioskDevice(input: {
  householdId: string;
  userId: string;
  name: string;
}): Promise<string> {
  const token = randomToken(32);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("devices")
    .insert({
      household_id: input.householdId,
      name: input.name,
      token_hash: await tokenHash(token),
      created_by: input.userId,
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  (await cookies()).set(KIOSK_COOKIE, token, cookieOptions);
  return data.id;
}

/** Refresh the cookie's 1-year expiry (call on kiosk page loads). */
export async function refreshKioskCookie(): Promise<void> {
  const store = await cookies();
  const token = store.get(KIOSK_COOKIE)?.value;
  if (token) {
    try {
      store.set(KIOSK_COOKIE, token, cookieOptions);
    } catch {
      // Server Components can't set cookies; route handlers refresh instead.
    }
  }
}

export async function clearKioskCookie(): Promise<void> {
  (await cookies()).delete(KIOSK_COOKIE);
}

export async function hasKioskCookie(): Promise<boolean> {
  return Boolean((await cookies()).get(KIOSK_COOKIE)?.value);
}
