import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBoard, type BoardChoreRow, type BoardSections, type BoardSubmissionRow } from "@/lib/board/buildBoard";
import { getHouseholdAccess } from "@/lib/billing/access";
import { asLocale, type Locale } from "@/lib/i18n";
import type { KioskContext } from "./auth";

/*
 * THE KIOSK WHITELIST (SPEC §4 "Row-Level Security").
 *
 * Kids Mode runs without a parent session. Every function here uses the
 * service-role client and MUST filter by ctx.householdId, which came from
 * the device token, never from the client. Kiosk requests may only:
 *   1. listKids          – picker with balances
 *   2. getBoard          – one kid's chore board
 *   3. createSubmission  – "I did it!"
 *   4. resubmit          – "Fixed it!"
 *   5. getKidHistory     – one kid's recent money
 * Nothing else. Do not add operations here without updating the spec.
 */

export interface KioskHousehold {
  id: string;
  name: string;
  currency: string;
  locale: Locale;
  timezone: string;
  weekStartsOn: number;
  kidIdleSeconds: number;
  theme: string;
  paused: boolean;
}

export interface KioskKid {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  balanceCents: number;
  pendingCents: number;
}

async function loadHousehold(ctx: KioskContext): Promise<KioskHousehold> {
  const admin = createAdminClient();
  const [{ data: h, error }, { data: sub }] = await Promise.all([
    admin.from("households").select("*").eq("id", ctx.householdId).single(),
    admin.from("subscriptions").select("*").eq("household_id", ctx.householdId).maybeSingle(),
  ]);
  if (error || !h) throw error ?? new Error("household not found");
  return {
    id: h.id,
    name: h.name,
    currency: h.currency,
    locale: asLocale(h.locale),
    timezone: h.timezone,
    weekStartsOn: h.week_starts_on,
    kidIdleSeconds: h.kid_idle_seconds,
    theme: h.theme,
    paused: getHouseholdAccess(sub, new Date()) !== "full",
  };
}

async function signAvatars(paths: (string | null)[]): Promise<Map<string, string>> {
  const wanted = paths.filter((p): p is string => Boolean(p));
  const out = new Map<string, string>();
  if (wanted.length === 0) return out;
  const { data } = await createAdminClient().storage.from("avatars").createSignedUrls(wanted, 60 * 60 * 6);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

async function kidsWithBalances(householdId: string, kidId?: string): Promise<KioskKid[]> {
  const admin = createAdminClient();
  let kidsQuery = admin
    .from("kids")
    .select("id, name, color, avatar_path, sort_order")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  if (kidId) kidsQuery = kidsQuery.eq("id", kidId);
  const [{ data: kids }, { data: balances }] = await Promise.all([
    kidsQuery,
    admin.from("kid_balances").select("*").eq("household_id", householdId),
  ]);
  const avatars = await signAvatars((kids ?? []).map((k) => k.avatar_path));
  const bal = new Map((balances ?? []).map((b) => [b.kid_id, b]));
  return (kids ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    color: k.color,
    avatarUrl: k.avatar_path ? (avatars.get(k.avatar_path) ?? null) : null,
    balanceCents: bal.get(k.id)?.balance_cents ?? 0,
    pendingCents: bal.get(k.id)?.pending_cents ?? 0,
  }));
}

// 1 ---------------------------------------------------------------------------
export async function listKids(ctx: KioskContext): Promise<{ household: KioskHousehold; kids: KioskKid[] }> {
  const [household, kids] = await Promise.all([loadHousehold(ctx), kidsWithBalances(ctx.householdId)]);
  return { household, kids };
}

/** Shared loader for chores + submissions of a household (also used by admin). */
export async function loadBoardData(
  client: ReturnType<typeof createAdminClient>,
  householdId: string,
): Promise<{ chores: BoardChoreRow[]; submissions: BoardSubmissionRow[] }> {
  const [{ data: chores }, { data: assignees }, { data: submissions }] = await Promise.all([
    client
      .from("chores")
      .select(
        "id, title, description, emoji, color, price_cents, unit_label, max_quantity, repeat_kind, repeat_every_days, scope, note_for_kids, available_from, available_until, sort_order, created_at",
      )
      .eq("household_id", householdId)
      .eq("active", true),
    client.from("chore_assignees").select("chore_id, kid_id").eq("household_id", householdId),
    client
      .from("submissions")
      .select("id, chore_id, kid_id, status, quantity, amount_cents, chore_title_snapshot, submitted_at, reviewed_at, review_comment")
      .eq("household_id", householdId)
      .order("submitted_at", { ascending: false })
      .limit(5000),
  ]);
  const byChore = new Map<string, string[]>();
  for (const a of assignees ?? []) {
    byChore.set(a.chore_id, [...(byChore.get(a.chore_id) ?? []), a.kid_id]);
  }
  return {
    chores: (chores ?? []).map((c) => ({
      ...c,
      repeat_kind: c.repeat_kind as BoardChoreRow["repeat_kind"],
      scope: c.scope as BoardChoreRow["scope"],
      assignee_ids: byChore.get(c.id) ?? [],
    })),
    submissions: (submissions ?? []).map((s) => ({ ...s, status: s.status as BoardSubmissionRow["status"] })),
  };
}

// 2 ---------------------------------------------------------------------------
export interface KioskBoard {
  household: KioskHousehold;
  kid: KioskKid;
  sections: BoardSections;
  now: string;
  /** last_seen_board_at before this visit; polls send it back so "New!" badges don't vanish. */
  seenBefore: string | null;
}

export async function getBoard(
  ctx: KioskContext,
  kidId: string,
  opts: { markSeen: boolean; seenBefore?: string | null },
): Promise<KioskBoard | null> {
  const admin = createAdminClient();
  const { data: kidRow } = await admin
    .from("kids")
    .select("id, last_seen_board_at")
    .eq("household_id", ctx.householdId)
    .eq("id", kidId)
    .is("archived_at", null)
    .maybeSingle();
  if (!kidRow) return null;

  const [household, kids, data] = await Promise.all([
    loadHousehold(ctx),
    kidsWithBalances(ctx.householdId, kidId),
    loadBoardData(admin, ctx.householdId),
  ]);
  const now = new Date();
  const seenBefore = opts.markSeen ? kidRow.last_seen_board_at : (opts.seenBefore ?? kidRow.last_seen_board_at);
  const sections = buildBoard({
    ...data,
    kidId,
    kidLastSeenBoardAt: seenBefore,
    household: { timezone: household.timezone, week_starts_on: household.weekStartsOn },
    now,
  });

  if (opts.markSeen) {
    await admin
      .from("kids")
      .update({ last_seen_board_at: now.toISOString() })
      .eq("household_id", ctx.householdId)
      .eq("id", kidId);
  }
  return { household, kid: kids[0]!, sections, now: now.toISOString(), seenBefore };
}

// 3 ---------------------------------------------------------------------------
export type SubmitResult =
  | { ok: true; submissionId: string }
  | { ok: false; reason: "taken" | "paused" | "invalid" | "error" };

function reasonFromError(message: string): "taken" | "paused" | "invalid" | "error" {
  if (message.includes("already_taken") || message.includes("chore_unavailable")) return "taken";
  if (message.includes("board_paused")) return "paused";
  if (message.includes("quantity") || message.includes("kid_not_found")) return "invalid";
  return "error";
}

export async function createSubmission(
  ctx: KioskContext,
  input: { kidId: string; choreId: string; quantity: number; idempotencyKey: string; expectedLastId: string | null },
): Promise<SubmitResult> {
  const { data, error } = await createAdminClient().rpc("kiosk_create_submission", {
    p_household_id: ctx.householdId,
    p_kid_id: input.kidId,
    p_chore_id: input.choreId,
    p_quantity: input.quantity,
    p_idempotency_key: input.idempotencyKey,
    p_device_id: ctx.deviceId,
    // The generated type says string; null is valid SQL here (no prior submission).
    p_expected_last_id: input.expectedLastId as string,
  });
  if (error) return { ok: false, reason: reasonFromError(error.message) };
  return { ok: true, submissionId: data.id };
}

// 4 ---------------------------------------------------------------------------
export async function resubmit(
  ctx: KioskContext,
  input: { kidId: string; submissionId: string },
): Promise<SubmitResult> {
  const { data, error } = await createAdminClient().rpc("kiosk_resubmit", {
    p_household_id: ctx.householdId,
    p_kid_id: input.kidId,
    p_submission_id: input.submissionId,
  });
  if (error) return { ok: false, reason: reasonFromError(error.message) };
  return { ok: true, submissionId: data.id };
}

// 5 ---------------------------------------------------------------------------
export interface KidHistoryItem {
  id: string;
  kind: string;
  amountCents: number;
  note: string | null;
  createdAt: string;
}

export async function getKidHistory(ctx: KioskContext, kidId: string): Promise<KidHistoryItem[]> {
  const { data } = await createAdminClient()
    .from("ledger_entries")
    .select("id, kind, amount_cents, note, created_at")
    .eq("household_id", ctx.householdId)
    .eq("kid_id", kidId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    amountCents: r.amount_cents,
    note: r.note,
    createdAt: r.created_at,
  }));
}
