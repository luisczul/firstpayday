import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeAdminNext } from "@/lib/email/reviewEmail";

const TYPES = new Set<EmailOtpType>(["magiclink", "email"]);

/**
 * One-click sign-in from app emails (e.g. "Review now"): verifies the hashed
 * token server-side, sets the session cookie, then redirects to an /admin path.
 * Tokens are single-use and expire (Supabase OTP expiry, 1h).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeAdminNext(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (tokenHash && type && TYPES.has(type)) {
    const supabase = await createClient();
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  if (ok) return NextResponse.redirect(new URL(next, request.url));
  const login = new URL("/login", request.url);
  login.searchParams.set("error", "link");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
