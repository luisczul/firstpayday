import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  ADMIN_MODE_COOKIE,
  KIOSK_COOKIE,
  adminModeCookieOptions,
  kioskCookieOptions,
  readAdminMode,
  signAdminMode,
} from "@/lib/auth/adminMode";
import {
  AUTH_PATHS,
  LANG_HEADER,
  PUBLIC_PATHS,
  SIGNUP_LANG_COOKIE,
  isSiteLang,
  splitLocalePath,
} from "@/lib/i18n/marketing/routes";

// SPEC §11 middleware: refresh the Supabase session, protect /admin and
// /platform, and enforce the Admin Mode timeout on kiosk tablets.

export async function middleware(request: NextRequest) {
  // Public-site language: /fr|/es|/pt prefix, or ?lang= on the auth pages. Always
  // overwritten, so a client can't inject it. Read by the root layout (<html lang>).
  const locale = splitLocalePath(request.nextUrl.pathname);
  const queryLang = request.nextUrl.searchParams.get("lang");
  const siteLang =
    locale.prefixed ? locale.lang
    : AUTH_PATHS.includes(locale.path) && isSiteLang(queryLang) ? queryLang
    : "en";
  request.headers.set(LANG_HEADER, siteLang);

  if (locale.prefixed) {
    const url = request.nextUrl.clone();
    if (locale.lang === "en") {
      // /en/terms → /terms (English lives at the root).
      url.pathname = locale.path;
      return NextResponse.redirect(url, 308);
    }
    if (AUTH_PATHS.includes(locale.path)) {
      // /fr/signup → /signup?lang=fr (auth routes stay where they are).
      url.pathname = locale.path;
      url.searchParams.set("lang", locale.lang);
      return NextResponse.redirect(url);
    }
  }

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
  const kioskToken = request.cookies.get(KIOSK_COOKIE)?.value;
  const onKiosk = Boolean(kioskToken);

  // A kids' tablet always comes back to the kids' board (e.g. after a parent logs out).
  if (onKiosk && locale.path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/kids";
    url.search = "";
    return NextResponse.redirect(url);
  }
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

  // Sliding one-year lifetime: every visit on the tablet pushes the expiry out again.
  if (kioskToken && path.startsWith("/kids")) response.cookies.set(KIOSK_COOKIE, kioskToken, kioskCookieOptions);

  // Remember the language a parent signs up in; onboarding defaults the household to it.
  if (path === "/signup") {
    if (siteLang !== "en") response.cookies.set(SIGNUP_LANG_COOKIE, siteLang, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
    else if (request.cookies.get(SIGNUP_LANG_COOKIE)) response.cookies.delete(SIGNUP_LANG_COOKIE);
  }

  // /fr/terms → render /terms in French (same URL in the address bar).
  if (locale.prefixed && PUBLIC_PATHS.includes(locale.path)) {
    const url = request.nextUrl.clone();
    url.pathname = locale.path;
    const rewrite = NextResponse.rewrite(url, { request });
    for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie);
    return rewrite;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, the Stripe webhook (raw body) and kiosk APIs.
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|api/stripe/webhook|api/kiosk|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
