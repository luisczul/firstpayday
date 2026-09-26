"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveKiosk } from "@/lib/kiosk/auth";
import { ADMIN_MODE_COOKIE, adminModeCookieOptions, signAdminMode } from "@/lib/auth/adminMode";
import { verifyPin } from "@/lib/crypto";
import { requireEnv } from "@/lib/env";

// Parent unlock from the kiosk (SPEC §7 "Getting into Admin from the tablet").
// These are parent-authentication actions, not kid operations.

export type UnlockResult = { ok: true } | { ok: false; reason: "wrong" | "locked" | "not_kiosk" };

const PIN_MAX_TRIES = 5;
const PIN_LOCK_MINUTES = 5;

async function startAdminMode(userId: string, householdId: string) {
  const { data: h } = await createAdminClient()
    .from("households")
    .select("admin_timeout_minutes")
    .eq("id", householdId)
    .single();
  (await cookies()).set(
    ADMIN_MODE_COOKIE,
    await signAdminMode(userId, h?.admin_timeout_minutes ?? 30),
    adminModeCookieOptions,
  );
}

async function isMember(householdId: string, userId: string) {
  const { data } = await createAdminClient()
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function unlockWithPassword(input: { email: string; password: string }): Promise<UnlockResult> {
  const kiosk = await resolveKiosk();
  if (kiosk.status !== "ok") return { ok: false, reason: "not_kiosk" };
  const parsed = z.object({ email: z.email(), password: z.string().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "wrong" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { ok: false, reason: "wrong" };

  // Only parents of *this* tablet's household may unlock it.
  if (!(await isMember(kiosk.ctx.householdId, data.user.id))) {
    await supabase.auth.signOut();
    return { ok: false, reason: "wrong" };
  }
  await startAdminMode(data.user.id, kiosk.ctx.householdId);
  return { ok: true };
}

export interface PinParent {
  userId: string;
  name: string;
}

/** Parents of this tablet's household who set a PIN. */
export async function pinParents(): Promise<PinParent[]> {
  const kiosk = await resolveKiosk();
  if (kiosk.status !== "ok") return [];
  const { data } = await createAdminClient()
    .from("household_members")
    .select("user_id, display_name")
    .eq("household_id", kiosk.ctx.householdId)
    .not("pin_hash", "is", null);
  return (data ?? []).map((m) => ({ userId: m.user_id, name: m.display_name || "Parent" }));
}

export async function unlockWithPin(input: { userId: string; pin: string }): Promise<UnlockResult> {
  const kiosk = await resolveKiosk();
  if (kiosk.status !== "ok") return { ok: false, reason: "not_kiosk" };
  const parsed = z.object({ userId: z.uuid(), pin: z.string().regex(/^\d{4,6}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "wrong" };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("household_members")
    .select("user_id, pin_hash, pin_failed_attempts, pin_locked_until")
    .eq("household_id", kiosk.ctx.householdId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!member?.pin_hash) return { ok: false, reason: "wrong" };
  if (member.pin_locked_until && new Date(member.pin_locked_until) > new Date()) {
    return { ok: false, reason: "locked" };
  }

  const good = await verifyPin(parsed.data.pin, member.pin_hash, requireEnv("ADMIN_MODE_SECRET"));
  if (!good) {
    const attempts = member.pin_failed_attempts + 1;
    const lock = attempts >= PIN_MAX_TRIES;
    await admin
      .from("household_members")
      .update({
        pin_failed_attempts: lock ? 0 : attempts,
        pin_locked_until: lock ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString() : null,
      })
      .eq("household_id", kiosk.ctx.householdId)
      .eq("user_id", member.user_id);
    return { ok: false, reason: lock ? "locked" : "wrong" };
  }

  await admin
    .from("household_members")
    .update({ pin_failed_attempts: 0, pin_locked_until: null })
    .eq("household_id", kiosk.ctx.householdId)
    .eq("user_id", member.user_id);

  // Mint a real parent session without the password: a one-time magic-link
  // token verified server-side, never sent anywhere.
  const { data: userData } = await admin.auth.admin.getUserById(member.user_id);
  const email = userData.user?.email;
  if (!email) return { ok: false, reason: "wrong" };
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.properties?.hashed_token) return { ok: false, reason: "wrong" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (error) return { ok: false, reason: "wrong" };

  await startAdminMode(member.user_id, kiosk.ctx.householdId);
  return { ok: true };
}
