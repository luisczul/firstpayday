"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_MODE_COOKIE, KIOSK_COOKIE, adminModeCookieOptions, signAdminMode } from "@/lib/auth/adminMode";
import { appUrl } from "@/lib/env";
import { asLocale, localeFromBrowser, type Locale } from "@/lib/i18n";
import { authCopy } from "@/lib/i18n/authCopy";
import { SIGNUP_LANG_COOKIE } from "@/lib/i18n/marketing/routes";

/** The visitor's language: the one they chose on the public site (?lang= / /fr…), else the browser's. */
async function visitorLocale(form?: FormData): Promise<Locale> {
  const fromForm = form?.get("lang");
  if (typeof fromForm === "string" && fromForm) return asLocale(fromForm);
  const c = (await cookies()).get(SIGNUP_LANG_COOKIE)?.value;
  if (c) return asLocale(c);
  return localeFromBrowser((await headers()).get("accept-language"));
}

export type AuthState = { error?: string; message?: string } | undefined;

const Creds = z.object({ email: z.email(), password: z.string().min(8, "password8").max(200) });

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : appUrl();
}

/** Logging in on the kiosk tablet itself starts a timed Admin Mode (SPEC §7). */
async function maybeStartAdminMode(userId: string) {
  const store = await cookies();
  if (!store.get(KIOSK_COOKIE)?.value) return;
  const { data } = await createAdminClient()
    .from("household_members")
    .select("households(admin_timeout_minutes)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const minutes = (data?.households as { admin_timeout_minutes: number } | null)?.admin_timeout_minutes ?? 30;
  store.set(ADMIN_MODE_COOKIE, await signAdminMode(userId, minutes), adminModeCookieOptions);
}

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/admin";
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const m = authCopy(await visitorLocale(form));
  const parsed = z.object({ email: z.email(), password: z.string().min(1) }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: m("emailPassword") };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: m("noMatch") };
  await maybeStartAdminMode(data.user.id);
  redirect(safeNext(form.get("next")));
}

export async function sendMagicLink(_: AuthState, form: FormData): Promise<AuthState> {
  const m = authCopy(await visitorLocale(form));
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: m("emailFirst") };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${await origin()}/auth/callback?next=/admin` },
  });
  if (error) return { error: m("linkFailed") };
  return { message: m("linkSent") };
}

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const m = authCopy(await visitorLocale(form));
  if (form.get("terms") !== "on") return { error: m("acceptTerms") };
  const parsed = Creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message === "password8" ? m("password8") : m("checkForm") };
  const supabase = await createClient();
  const locale = await visitorLocale(form);
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      // Lets the Supabase confirmation email template speak the parent's language ({{ .Data.locale }}).
      data: { locale },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(
        typeof form.get("next") === "string" && String(form.get("next")).startsWith("/invite/") ? String(form.get("next")) : "/onboarding/home",
      )}`,
    },
  });
  if (error) return { error: /already registered|already been registered/i.test(error.message) ? m("alreadyRegistered") : error.message };
  const next = form.get("next");
  const dest = typeof next === "string" && next.startsWith("/invite/") ? next : "/onboarding/home";
  if (!data.session) return { message: m("confirmEmail") };
  redirect(dest);
}

export async function requestReset(_: AuthState, form: FormData): Promise<AuthState> {
  const m = authCopy(await visitorLocale(form));
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: m("validEmail") };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await origin()}/auth/callback?next=/reset/update`,
  });
  // Same answer whether or not the account exists.
  return { message: m("resetSent") };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const m = authCopy(await visitorLocale(form));
  const password = z.string().min(8).max(200).safeParse(form.get("password"));
  if (!password.success) return { error: m("password8") };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: m("resetExpired") };
  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(ADMIN_MODE_COOKIE);
  redirect("/");
}
