import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCheckin } from "@/lib/reports/checkins";
import { buildBoard, type BoardChoreRow, type BoardClaimRow, type BoardSections, type BoardSubmissionRow } from "@/lib/board/buildBoard";
import { getHouseholdAccess } from "@/lib/billing/access";
import { asLocale, type Locale } from "@/lib/i18n";
import { choreTextFor } from "@/lib/translate";
import { localizeSubtasks, parseSubtasks } from "@/lib/schedule/checklist";
import type { KioskContext } from "./auth";
import { loadKioskMoneyExtras, type KioskMoneyExtras } from "./taxPromo";

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
 *   6. toggleSubtask     – tick / untick one step of a checklist chore
 *   7. withdraw          – give up a sent-back chore ("too hard for me")
 *   8. claimChore        – "I'm on it!" on a whole-house chore (siblings see it locked)
 *   9. releaseClaim      – give a claimed chore back
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
  /** Chores a parent sent back or asked to revise. */
  revisions: number;
}

async function loadHousehold(ctx: KioskContext): Promise<KioskHousehold> {
  const admin = createAdminClient();
  const [{ data: h, error }, { data: sub }, { count: activeKids }] = await Promise.all([
    admin.from("households").select("*").eq("id", ctx.householdId).single(),
    admin.from("subscriptions").select("*").eq("household_id", ctx.householdId).maybeSingle(),
    admin.from("kids").select("id", { count: "exact", head: true }).eq("household_id", ctx.householdId).is("archived_at", null),
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
    paused: getHouseholdAccess(sub, new Date(), activeKids ?? 0) !== "full",
  };
}

async function signAvatars(paths: (string | null)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  // Cartoon avatars ("preset:fox") aren't files: pass them through for <KidAvatar>.
  for (const p of paths) if (p?.startsWith("preset:")) out.set(p, p);
  const wanted = paths.filter((p): p is string => Boolean(p) && !p!.startsWith("preset:"));
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
  const [{ data: kids }, { data: balances }, { data: sentBack }] = await Promise.all([
    kidsQuery,
    admin.from("kid_balances").select("*").eq("household_id", householdId),
    admin.from("submissions").select("kid_id").eq("household_id", householdId).eq("status", "sent_back"),
  ]);
  const revisions = new Map<string, number>();
  for (const r of sentBack ?? []) revisions.set(r.kid_id, (revisions.get(r.kid_id) ?? 0) + 1);
  const avatars = await signAvatars((kids ?? []).map((k) => k.avatar_path));
  const bal = new Map((balances ?? []).map((b) => [b.kid_id, b]));
  return (kids ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    color: k.color,
    avatarUrl: k.avatar_path ? (avatars.get(k.avatar_path) ?? null) : null,
    balanceCents: bal.get(k.id)?.balance_cents ?? 0,
    pendingCents: bal.get(k.id)?.pending_cents ?? 0,
    revisions: revisions.get(k.id) ?? 0,
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
        "id, title, description, emoji, color, price_cents, unit_label, max_quantity, repeat_kind, repeat_every_days, scope, note_for_kids, available_from, available_until, sort_order, created_at, category, template_key, translations, reset_at, subtasks",
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
  /** Family tax (taxes this kid paid so far) and promotions live right now. */
  tax: KioskMoneyExtras["tax"];
  promos: KioskMoneyExtras["promos"];
  paidOutCents: KioskMoneyExtras["paidOutCents"];
  /**
   * Chores this kid claimed whose time ran out since the last visit ("went back on
   * the board"). Only filled when the board is opened (markSeen); each shows once.
   */
  expiredClaims: { choreId: string; title: string }[];
}

/** Claims whose time ran out in the last day are worth a nudge; older ones just close quietly. */
const EXPIRED_NUDGE_MS = 24 * 60 * 60 * 1000;

export async function getBoard(
  ctx: KioskContext,
  kidId: string,
  opts: { markSeen: boolean; seenBefore?: string | null },
): Promise<KioskBoard | null> {
  const admin = createAdminClient();
  const { data: kidRow } = await admin
    .from("kids")
    .select("id, last_seen_board_at, locale")
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
  // The kid's own language: screens, plus each chore's saved translation
  // (or, for older starter chores the parent hasn't renamed, the template text).
  const kidLocale = asLocale(kidRow.locale ?? household.locale);
  if (kidLocale !== household.locale) {
    data.chores = await translateTemplateChores(admin, data.chores, household.locale, kidLocale);
  }
  data.chores = data.chores.map((c) => {
    const t = choreTextFor(c.translations, kidLocale);
    if (!t) return c;
    const { subtasks: steps, ...text } = t;
    return { ...c, ...text, subtasks: localizeSubtasks(parseSubtasks(c.subtasks), steps) };
  });
  household.locale = kidLocale;
  // Checklist ticks for the current period of each checklist chore.
  const { data: progress } = await admin.rpc("kiosk_checklist_progress", { p_household_id: ctx.householdId, p_kid_id: kidId });
  const checks: Record<string, string[]> = {};
  for (const [choreId, p] of Object.entries((progress ?? {}) as Record<string, { checked?: string[] }>)) {
    checks[choreId] = p.checked ?? [];
  }

  const now = new Date();
  const [claims, expiredClaims] = await Promise.all([
    loadActiveClaims(admin, ctx.householdId, now),
    opts.markSeen ? closeExpiredClaims(admin, ctx.householdId, kidId, now) : Promise.resolve([]),
  ]);
  const seenBefore = opts.markSeen ? kidRow.last_seen_board_at : (opts.seenBefore ?? kidRow.last_seen_board_at);
  const sections = buildBoard({
    ...data,
    kidId,
    kidLastSeenBoardAt: seenBefore,
    household: { timezone: household.timezone, week_starts_on: household.weekStartsOn },
    now,
    checks,
    claims,
  });
  const titles = new Map(data.chores.map((c) => [c.id, c.title]));

  if (opts.markSeen) {
    // A board open from the picker is a "check-in" (parent usage stats, weekly report).
    after(() => recordCheckin(ctx, kidId));
    await admin
      .from("kids")
      .update({ last_seen_board_at: now.toISOString() })
      .eq("household_id", ctx.householdId)
      .eq("id", kidId);
  }
  const extras = await loadKioskMoneyExtras(admin, ctx.householdId, kidId, now);
  return {
    household,
    kid: kids[0]!,
    sections,
    now: now.toISOString(),
    seenBefore,
    ...extras,
    // Only chores still on the board (a paused or deleted chore needs no nudge).
    expiredClaims: expiredClaims
      .filter((c) => titles.has(c.chore_id))
      .map((c) => ({ choreId: c.chore_id, title: titles.get(c.chore_id)! })),
  };
}

/** Every unexpired, unreleased claim of the household, with the kid's name. */
async function loadActiveClaims(
  client: ReturnType<typeof createAdminClient>,
  householdId: string,
  now: Date,
): Promise<BoardClaimRow[]> {
  const { data } = await client
    .from("chore_claims")
    .select("id, chore_id, kid_id, quantity, expires_at, released_at, kids(name)")
    .eq("household_id", householdId)
    .is("released_at", null)
    .gt("expires_at", now.toISOString());
  return (data ?? []).map((c) => ({
    id: c.id,
    chore_id: c.chore_id,
    kid_id: c.kid_id,
    kid_name: c.kids?.name ?? "",
    quantity: c.quantity,
    expires_at: c.expires_at,
    released_at: c.released_at,
  }));
}

/**
 * Lazy expiry: this kid's claims whose time ran out are closed as 'expired'.
 * Returns the ones that ran out in the last day, for a one-time nudge.
 */
async function closeExpiredClaims(
  client: ReturnType<typeof createAdminClient>,
  householdId: string,
  kidId: string,
  now: Date,
): Promise<{ id: string; chore_id: string }[]> {
  const { data } = await client
    .from("chore_claims")
    .select("id, chore_id, expires_at")
    .eq("household_id", householdId)
    .eq("kid_id", kidId)
    .is("released_at", null)
    .lte("expires_at", now.toISOString());
  const expired = data ?? [];
  for (const c of expired) {
    await client
      .from("chore_claims")
      .update({ released_at: c.expires_at, release_reason: "expired" })
      .eq("id", c.id)
      .is("released_at", null);
  }
  const cutoff = now.getTime() - EXPIRED_NUDGE_MS;
  return expired.filter((c) => new Date(c.expires_at).getTime() > cutoff);
}

/** Swap in the template text in `to` for starter chores still using the `from` template text. */
async function translateTemplateChores(
  client: ReturnType<typeof createAdminClient>,
  chores: BoardChoreRow[],
  from: Locale,
  to: Locale,
): Promise<BoardChoreRow[]> {
  const keys = [...new Set(chores.map((c) => c.template_key).filter((k): k is string => Boolean(k)))];
  if (keys.length === 0) return chores;
  const { data } = await client.from("chore_templates").select("key, locale, title, description, unit_label").in("key", keys);
  const t = new Map((data ?? []).map((r) => [`${r.key}:${r.locale}`, r]));
  return chores.map((c) => {
    const src = c.template_key ? t.get(`${c.template_key}:${from}`) : undefined;
    const dst = c.template_key ? t.get(`${c.template_key}:${to}`) : undefined;
    if (!src || !dst) return c;
    return {
      ...c,
      title: c.title === src.title ? dst.title : c.title,
      description: c.description === src.description ? dst.description : c.description,
      unit_label: c.unit_label === src.unit_label ? dst.unit_label : c.unit_label,
    };
  });
}

// 3 ---------------------------------------------------------------------------
export type SubmitResult =
  | { ok: true; submissionId: string }
  | { ok: false; reason: "taken" | "claimed" | "paused" | "invalid" | "incomplete" | "error" };

function reasonFromError(message: string): "taken" | "claimed" | "paused" | "invalid" | "incomplete" | "error" {
  if (message.includes("checklist_incomplete")) return "incomplete";
  if (message.includes("chore_claimed")) return "claimed";
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

// 4b --------------------------------------------------------------------------
/** A kid gives up a chore that was sent back ("too hard for me"): it leaves Needs fixing and is free again. */
export async function withdraw(
  ctx: KioskContext,
  input: { kidId: string; submissionId: string },
): Promise<SubmitResult> {
  const { data, error } = await createAdminClient().rpc("kiosk_withdraw_submission", {
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
  /** A parent's custom reward: its icon and name (in the kid's language when translated). */
  icon?: string | null;
  title?: string | null;
  createdAt: string;
}

export async function getKidHistory(ctx: KioskContext, kidId: string): Promise<KidHistoryItem[]> {
  const admin = createAdminClient();
  const [{ data }, { data: kid }, { data: home }] = await Promise.all([
    admin
      .from("ledger_entries")
      .select("id, kind, amount_cents, note, icon, title, translations, created_at, submissions(chore_title_snapshot, chores(title, translations))")
      .eq("household_id", ctx.householdId)
      .eq("kid_id", kidId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("kids").select("locale").eq("household_id", ctx.householdId).eq("id", kidId).maybeSingle(),
    admin.from("households").select("locale").eq("id", ctx.householdId).maybeSingle(),
  ]);
  const kidLocale = asLocale(kid?.locale ?? home?.locale);
  return (data ?? []).map((r) => {
    // Notes carry the chore's name as it was (in the home's language): show it in the kid's language.
    const snapshot = r.submissions?.chore_title_snapshot;
    const localized = choreTextFor(r.submissions?.chores?.translations, kidLocale)?.title ?? r.submissions?.chores?.title;
    const note = r.note && snapshot && localized && r.note.endsWith(snapshot) ? r.note.slice(0, r.note.length - snapshot.length) + localized : r.note;
    if (r.title) {
      const tr = choreTextFor(r.translations, kidLocale);
      return { id: r.id, kind: r.kind, amountCents: r.amount_cents, note: tr ? tr.description : r.note, icon: r.icon, title: tr?.title ?? r.title, createdAt: r.created_at };
    }
    return { id: r.id, kind: r.kind, amountCents: r.amount_cents, note, createdAt: r.created_at };
  });
}

// 6 ---------------------------------------------------------------------------
export type ToggleSubtaskResult =
  | { ok: true; checked: string[] }
  | { ok: false; reason: "paused" | "invalid" | "error" };

/** Tick or untick one checklist step for the chore's current period (kiosk_toggle_subtask). */
export async function toggleSubtask(
  ctx: KioskContext,
  input: { kidId: string; choreId: string; subtaskId: string; checked: boolean },
): Promise<ToggleSubtaskResult> {
  const { data, error } = await createAdminClient().rpc("kiosk_toggle_subtask", {
    p_household_id: ctx.householdId,
    p_kid_id: input.kidId,
    p_chore_id: input.choreId,
    p_subtask_id: input.subtaskId,
    p_checked: input.checked,
    p_device_id: ctx.deviceId,
  });
  if (error) {
    if (error.message.includes("board_paused")) return { ok: false, reason: "paused" };
    if (/chore_unavailable|kid_not_found|subtask_not_found/.test(error.message)) return { ok: false, reason: "invalid" };
    return { ok: false, reason: "error" };
  }
  return { ok: true, checked: ((data as { checked?: string[] } | null)?.checked ?? []).map(String) };
}

// 8 ---------------------------------------------------------------------------
export type ClaimResult =
  | { ok: true; claimId: string; expiresAt: string }
  | { ok: false; reason: "claimed" | "limit" | "taken" | "paused" | "invalid" | "error" };

/**
 * "I'm on it!": save a free whole-house chore for this kid until its time limit
 * (kiosk_claim_chore), for `quantity` units when the chore has a quantity.
 */
export async function claimChore(
  ctx: KioskContext,
  input: { kidId: string; choreId: string; quantity: number },
): Promise<ClaimResult> {
  const { data, error } = await createAdminClient().rpc("kiosk_claim_chore", {
    p_household_id: ctx.householdId,
    p_kid_id: input.kidId,
    p_chore_id: input.choreId,
    p_device_id: ctx.deviceId,
    p_quantity: input.quantity,
  });
  if (error) {
    const m = error.message;
    if (m.includes("chore_claimed")) return { ok: false, reason: "claimed" };
    if (m.includes("claim_limit")) return { ok: false, reason: "limit" };
    if (m.includes("chore_unavailable")) return { ok: false, reason: "taken" };
    if (m.includes("board_paused")) return { ok: false, reason: "paused" };
    if (m.includes("kid_not_found") || m.includes("quantity")) return { ok: false, reason: "invalid" };
    return { ok: false, reason: "error" };
  }
  return { ok: true, claimId: data.id, expiresAt: data.expires_at };
}

// 9 ---------------------------------------------------------------------------
export type ReleaseClaimResult = { ok: true } | { ok: false; reason: "invalid" | "error" };

/** "Give it back": the claimed chore is free again for everyone (kiosk_release_claim). */
export async function releaseClaim(ctx: KioskContext, input: { kidId: string; claimId: string }): Promise<ReleaseClaimResult> {
  const { error } = await createAdminClient().rpc("kiosk_release_claim", {
    p_household_id: ctx.householdId,
    p_kid_id: input.kidId,
    p_claim_id: input.claimId,
  });
  if (error) return { ok: false, reason: error.message.includes("claim_not_found") ? "invalid" : "error" };
  return { ok: true };
}
