"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_MODE_COOKIE, KIOSK_COOKIE, adminModeCookieOptions, signAdminMode } from "@/lib/auth/adminMode";
import { appUrl } from "@/lib/env";

export type AuthState = { error?: string; message?: string } | undefined;

const Creds = z.object({ email: z.email(), password: z.string().min(8, "Use at least 8 characters.").max(200) });

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
  const parsed = z.object({ email: z.email(), password: z.string().min(1) }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "That email and password don't match." };
  await maybeStartAdminMode(data.user.id);
  redirect(safeNext(form.get("next")));
}

export async function sendMagicLink(_: AuthState, form: FormData): Promise<AuthState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Enter your email first." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${await origin()}/auth/callback?next=/admin` },
  });
  if (error) return { error: "We couldn't send a link to that email." };
  return { message: "Check your email for a login link." };
}

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  if (form.get("terms") !== "on") return { error: "Please accept the Terms and Privacy Policy." };
  const parsed = Creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(
        typeof form.get("next") === "string" && String(form.get("next")).startsWith("/invite/") ? String(form.get("next")) : "/onboarding/home",
      )}`,
    },
  });
  if (error) return { error: error.message };
  const next = form.get("next");
  const dest = typeof next === "string" && next.startsWith("/invite/") ? next : "/onboarding/home";
  if (!data.session) return { message: "Check your email to confirm your account, then come back to log in." };
  redirect(dest);
}

export async function requestReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await origin()}/auth/callback?next=/reset/update`,
  });
  // Same answer whether or not the account exists.
  return { message: "If that email has an account, a reset link is on its way." };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = z.string().min(8, "Use at least 8 characters.").max(200).safeParse(form.get("password"));
  if (!password.success) return { error: password.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "Your reset link expired. Request a new one." };
  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ADMIN_MODE_COOKIE);
  redirect("/");
}
