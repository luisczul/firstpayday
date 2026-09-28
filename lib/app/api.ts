import "server-only";
import { createClient as createSupabaseClient, type Session } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { publicEnv } from "@/lib/env";
import { loadParentContext, type ParentContext } from "@/lib/auth/session";
import { asLocale, type Locale } from "@/lib/i18n";

// The native apps' API (docs/native/app-api.md). Apps send a Supabase access token as
// "Authorization: Bearer …"; every query runs as that parent, so RLS applies as on the web.

export type AppErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "invalid"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "server";

const MESSAGES: Record<Locale, Record<"unauthorized" | "emailNotConfirmed" | "server" | "noHousehold" | "notFound", string>> = {
  en: {
    unauthorized: "Please log in again.",
    emailNotConfirmed: "Confirm your email first: open the link we sent you, then log in.",
    server: "Something went wrong. Please try again.",
    noHousehold: "Finish setting up your home first.",
    notFound: "Not found.",
  },
  fr: {
    unauthorized: "Veuillez vous reconnecter.",
    emailNotConfirmed: "Confirmez d'abord votre courriel : ouvrez le lien que nous vous avons envoyé, puis connectez-vous.",
    server: "Une erreur s'est produite. Veuillez réessayer.",
    noHousehold: "Terminez d'abord la configuration de votre maison.",
    notFound: "Introuvable.",
  },
  es: {
    unauthorized: "Vuelve a iniciar sesión.",
    emailNotConfirmed: "Primero confirma tu correo: abre el enlace que te enviamos y luego inicia sesión.",
    server: "Algo salió mal. Inténtalo de nuevo.",
    noHousehold: "Primero termina de configurar tu hogar.",
    notFound: "No encontrado.",
  },
  pt: {
    unauthorized: "Entre novamente.",
    emailNotConfirmed: "Confirme seu e-mail primeiro: abra o link que enviamos e depois entre.",
    server: "Algo deu errado. Tente de novo.",
    noHousehold: "Termine de configurar sua casa primeiro.",
    notFound: "Não encontrado.",
  },
};

/** The app's language, from Accept-Language (en|fr|es|pt, or a full tag like fr-CA). */
export function appLocale(req: Request): Locale {
  const raw = (req.headers.get("accept-language") ?? "").split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return asLocale(raw);
}

export function appMessage(req: Request, key: keyof (typeof MESSAGES)["en"]): string {
  return MESSAGES[appLocale(req)][key];
}

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}

export function fail(code: AppErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

/** A Supabase client with no stored session (sign-in calls, or acting as a Bearer token). */
export function statelessClient(accessToken?: string) {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

export function sessionJson(session: Session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
    user: { id: session.user.id, email: session.user.email ?? "" },
  };
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1]!.trim() : null;
}

export type AppUser = { id: string; email: string; token: string; supabase: ReturnType<typeof statelessClient> };

/** The parent behind the Bearer token, or a 401 response. */
export async function appUser(req: Request): Promise<AppUser | NextResponse> {
  const token = bearer(req);
  if (!token) return fail("unauthorized", appMessage(req, "unauthorized"), 401);
  const supabase = statelessClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return fail("unauthorized", appMessage(req, "unauthorized"), 401);
  return { id: data.user.id, email: data.user.email ?? "", token, supabase };
}

/** The parent and their household (403 when onboarding isn't finished). */
export async function appParent(req: Request): Promise<ParentContext | NextResponse> {
  const user = await appUser(req);
  if (user instanceof NextResponse) return user;
  const ctx = await loadParentContext(user.supabase, user);
  if (!ctx) return fail("forbidden", appMessage(req, "noHousehold"), 403);
  return ctx;
}

/** JSON body, or null when it isn't valid JSON. */
export async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
