import { hmacHex, safeEqual } from "@/lib/crypto";

// Signed cookie that keeps Admin Mode alive on a kiosk tablet (SPEC §7).
// Value: `${userId}.${untilMs}.${timeoutMinutes}.${hmac}`.

export const ADMIN_MODE_COOKIE = "admin_mode_until";
export const KIOSK_COOKIE = "kiosk_token";

export interface AdminModeClaim {
  userId: string;
  until: number;
  timeoutMinutes: number;
}

function secret(): string {
  const s = process.env.ADMIN_MODE_SECRET;
  if (!s) throw new Error("Missing environment variable ADMIN_MODE_SECRET");
  return s;
}

export async function signAdminMode(userId: string, timeoutMinutes: number, now = Date.now()): Promise<string> {
  const until = now + timeoutMinutes * 60_000;
  const payload = `${userId}.${until}.${timeoutMinutes}`;
  return `${payload}.${await hmacHex(secret(), payload)}`;
}

export async function readAdminMode(value: string | undefined): Promise<AdminModeClaim | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [userId, untilStr, timeoutStr, sig] = parts as [string, string, string, string];
  const expected = await hmacHex(secret(), `${userId}.${untilStr}.${timeoutStr}`);
  if (!safeEqual(sig, expected)) return null;
  return { userId, until: Number(untilStr), timeoutMinutes: Number(timeoutStr) };
}

export const adminModeCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24,
};
