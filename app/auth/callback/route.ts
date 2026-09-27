import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Email links (confirm, magic link, password reset) land here. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("next") ?? "/admin";
  // Relative paths only: "//host" and "/\host" (read as "//host") would leave the site.
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/admin";
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  return NextResponse.redirect(new URL(ok ? safeNext : "/login?error=link", request.url));
}
