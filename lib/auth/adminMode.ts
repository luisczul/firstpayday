import { appSecret, hmacHex, safeEqual } from "@/lib/crypto";

// Signed cookie that keeps Admin Mode alive on a kiosk tablet (SPEC §7).
// Value: `${userId}.${untilMs}.${timeoutMinutes}.${hmac}`. timeoutMinutes 0 = "keep parent mode on":
// no inactivity timeout until the parent taps "Back to Kids Mode" (ADMIN_MODE_STAY).

export const ADMIN_MODE_COOKIE = "admin_mode_until";
export const KIOSK_COOKIE = "kiosk_token";

export interface AdminModeClaim {
  userId: string;
  until: number;
  timeoutMinutes: number;
}

const secret = () => appSecret("ADMIN_MODE_SECRET");

/** timeoutMinutes value meaning "stay in parent mode until I switch back". */
export const ADMIN_MODE_STAY = 0;

/** Parent mode is still on for this user: signed for them and not timed out (or kept on). */
export function adminModeActive(claim: AdminModeClaim | null, userId: string, now = Date.now()): boolean {
  if (!claim || claim.userId !== userId) return false;
  return claim.timeoutMinutes === ADMIN_MODE_STAY || claim.until > now;
}

/** Cookie options: a kept-on parent mode lasts up to 30 days (renewed on each visit), else a day. */
export function adminModeCookieOptionsFor(timeoutMinutes: number) {
  return { ...adminModeCookieOptions, maxAge: timeoutMinutes === ADMIN_MODE_STAY ? 60 * 60 * 24 * 30 : adminModeCookieOptions.maxAge };
}

export async function signAdminMode(userId: string, timeoutMinutes: number, now = Date.now()): Promise<string> {
  const until = now + timeoutMinutes * 60_000;
  const payload = `${userId}.${until}.${timeoutMinutes}`;
  return `${payload}.${await hmacHex(await secret(), payload)}`;
}

export async function readAdminMode(value: string | undefined): Promise<AdminModeClaim | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [userId, untilStr, timeoutStr, sig] = parts as [string, string, string, string];
  const expected = await hmacHex(await secret(), `${userId}.${untilStr}.${timeoutStr}`);
  if (!safeEqual(sig, expected)) return null;
  return { userId, until: Number(untilStr), timeoutMinutes: Number(timeoutStr) };
}

/** The kids' tablet key: one year, renewed on every visit, so parents never have to set it up again. */
export const kioskCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export const adminModeCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24,
};
