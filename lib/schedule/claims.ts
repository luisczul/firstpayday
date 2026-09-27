import { addDays, localDateOf, startOfLocalDay } from "./tz";

/**
 * "I'm on it!": a kid claims a whole-house chore so siblings don't race for it.
 * The database (kiosk_claim_chore) is the source of truth; these helpers only
 * decide what the boards show. A claim is active iff it isn't released and its
 * time isn't up (expiry is lazy, no cron).
 */

/** How long a claim lasts, per chore (chores.claim_window). */
export const CLAIM_WINDOWS = ["2h", "4h", "end_of_day", "24h", "48h"] as const;
export type ClaimWindow = (typeof CLAIM_WINDOWS)[number];
export const DEFAULT_CLAIM_WINDOW: ClaimWindow = "24h";

/** A kid can hold this many claims at once. */
export const MAX_ACTIVE_CLAIMS = 2;

export function asClaimWindow(value: string | null | undefined): ClaimWindow {
  return (CLAIM_WINDOWS as readonly string[]).includes(value ?? "") ? (value as ClaimWindow) : DEFAULT_CLAIM_WINDOW;
}

export interface ClaimLike {
  expires_at: string | Date;
  released_at: string | Date | null;
}

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

export function isClaimActive(claim: ClaimLike, now: Date): boolean {
  return claim.released_at === null && toDate(claim.expires_at) > now;
}

/** Only whole-house chores without steps can be claimed (routines and "each kid" chores can't). */
export function isClaimableChore(chore: { scope: string; subtasks?: unknown }): boolean {
  return chore.scope === "household" && !(Array.isArray(chore.subtasks) && chore.subtasks.length > 0);
}

/** Minutes left count as "the last hour" (the countdown turns amber). */
export const CLAIM_URGENT_MINUTES = 60;

export interface ClaimTimeLeft {
  hours: number;
  minutes: number;
  /** In the last hour. */
  urgent: boolean;
}

/** Whole hours and minutes left, rounded up so "0 min" never shows while it's still active. */
export function claimTimeLeft(expiresAt: string | Date, now: Date): ClaimTimeLeft {
  const total = Math.max(0, Math.ceil((toDate(expiresAt).getTime() - now.getTime()) / 60_000));
  return { hours: Math.floor(total / 60), minutes: total % 60, urgent: total <= CLAIM_URGENT_MINUTES };
}

export type ClaimDeadline =
  | { kind: "end_of_day" }
  | { kind: "today"; time: string }
  | { kind: "later"; weekday: string; time: string };

/**
 * "until 9:00 PM" (today), "until Sat 3:00 PM" (another day) or "until the end
 * of the day" (the next local midnight), in the household timezone.
 */
export function claimDeadline(expiresAt: string | Date, now: Date, intlTag: string, zone: string): ClaimDeadline {
  const at = toDate(expiresAt);
  const today = localDateOf(now, zone);
  if (at.getTime() === startOfLocalDay(addDays(today, 1), zone).getTime()) return { kind: "end_of_day" };
  // Explicit "timeZone: zone": the production minifier mangles a shorthand property here.
  const time = new Intl.DateTimeFormat(intlTag, { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(at);
  const day = localDateOf(at, zone);
  if (day.year === today.year && day.month === today.month && day.day === today.day) return { kind: "today", time };
  const weekday = new Intl.DateTimeFormat(intlTag, { timeZone: zone, weekday: "short" }).format(at);
  return { kind: "later", weekday, time };
}
