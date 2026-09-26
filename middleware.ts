import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  ADMIN_MODE_COOKIE,
  KIOSK_COOKIE,
  adminModeCookieOptions,
  readAdminMode,
  signAdminMode,
} from "@/lib/auth/adminMode";

// SPEC §11 middleware: refresh the Supabase session, protect /admin and
// /platform, and enforce the Admin Mode timeout on kiosk tablets.

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminArea = path.startsWith("/admin") || path.startsWith("/platform") || path.startsWith("/onboarding");

  if (isAdminArea && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  // Kiosk tablet in Admin Mode: must hold a valid, unexpired admin-mode cookie.
  const onKiosk = Boolean(request.cookies.get(KIOSK_COOKIE)?.value);
  if (isAdminArea && user && onKiosk) {
    const claim = await readAdminMode(request.cookies.get(ADMIN_MODE_COOKIE)?.value);
    if (!claim || claim.userId !== user.id || claim.until <= Date.now()) {
      const url = request.nextUrl.clone();
      url.pathname = "/api/admin-mode/exit";
      url.search = "?reason=timeout";
      return NextResponse.redirect(url);
    }
    response.cookies.set(
      ADMIN_MODE_COOKIE,
      await signAdminMode(user.id, claim.timeoutMinutes),
      adminModeCookieOptions,
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, the Stripe webhook (raw body) and kiosk APIs.
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|api/stripe/webhook|api/kiosk|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
