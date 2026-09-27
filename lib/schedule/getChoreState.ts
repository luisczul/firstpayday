import {
  addDays,
  dayOfWeek,
  daysBetween,
  localDateOf,
  parseLocalDate,
  startOfLocalDay,
  type LocalDate,
} from "./tz";

export type RepeatKind = "once" | "daily" | "weekly" | "every_n_days";
export type ChoreScope = "household" | "per_kid";
export type SubmissionStatus = "pending" | "approved" | "sent_back" | "rejected" | "reversed" | "withdrawn";

export type ChoreStateName =
  | "available"
  | "pending"
  | "needs_fixing"
  | "cooldown"
  | "done_forever"
  | "out_of_season"
  | "not_assigned";

export interface ScheduleChore {
  id: string;
  created_at: string | Date;
  repeat_kind: RepeatKind;
  repeat_every_days: number | null;
  scope: ChoreScope;
  available_from: string | null;
  available_until: string | null;
  /** Kid ids from chore_assignees; empty means every kid. */
  assignee_ids: readonly string[];
  /** "Make available now": submissions before this stop counting (open ones still do). */
  reset_at?: string | Date | null;
}

export interface ScheduleSubmission {
  id: string;
  chore_id: string;
  kid_id: string;
  status: SubmissionStatus;
  submitted_at: string | Date;
  reviewed_at?: string | Date | null;
  review_comment?: string | null;
}

export interface ScheduleHousehold {
  timezone: string;
  /** 0 = Sunday … 6 = Saturday. */
  week_starts_on: number;
}

export interface ChoreState<S extends ScheduleSubmission = ScheduleSubmission> {
  state: ChoreStateName;
  /** When the card becomes tappable again (cooldown, season start). */
  availableAt?: Date;
  /** When the card last became tappable (drives the "New!" badge). */
  becameAvailableAt?: Date;
  /** The submission this state is about (pending / needs fixing / blocker). */
  submission?: S;
  /**
   * The newest submission that counts toward this kid's cooldown. The kiosk
   * passes its id back when submitting, so the server can refuse if a
   * sibling tapped first (optimistic concurrency).
   */
  latestRelevant?: S;
}

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));
const maxDate = (...dates: (Date | undefined)[]) =>
  dates.reduce<Date | undefined>((a, b) => (!b ? a : !a || b > a ? b : a), undefined);

/**
 * When a chore submitted at `submittedAt` becomes available again
 * (SPEC §5). Returns null for `once` chores (never on its own).
 */
export function nextAvailableAt(
  chore: Pick<ScheduleChore, "repeat_kind" | "repeat_every_days">,
  submittedAt: Date,
  household: ScheduleHousehold,
): Date | null {
  const tz = household.timezone;
  const day = localDateOf(submittedAt, tz);
  switch (chore.repeat_kind) {
    case "once":
      return null;
    case "daily":
      return startOfLocalDay(addDays(day, 1), tz);
    case "weekly": {
      const back = (dayOfWeek(day) - household.week_starts_on + 7) % 7;
      return startOfLocalDay(addDays(day, 7 - back), tz);
    }
    case "every_n_days":
      return startOfLocalDay(addDays(day, Math.max(1, chore.repeat_every_days ?? 1)), tz);
  }
}

function seasonWindow(chore: ScheduleChore, tz: string): { start?: Date; end?: Date } {
  return {
    start: chore.available_from ? startOfLocalDay(parseLocalDate(chore.available_from), tz) : undefined,
    // available_until is inclusive: the window closes at the next local midnight.
    end: chore.available_until
      ? startOfLocalDay(addDays(parseLocalDate(chore.available_until), 1), tz)
      : undefined,
  };
}

function newest<S extends ScheduleSubmission>(subs: readonly S[]): S | undefined {
  let best: S | undefined;
  for (const s of subs) {
    if (!best) {
      best = s;
      continue;
    }
    const a = toDate(s.submitted_at).getTime();
    const b = toDate(best.submitted_at).getTime();
    // Same tie-break as kiosk_create_submission: submitted_at desc, id desc.
    if (a > b || (a === b && s.id > best.id)) best = s;
  }
  return best;
}

/**
 * The single source of truth for whether a chore card is shown to a kid,
 * hidden, or coming back (SPEC §5). Pure: no I/O, no Date.now().
 *
 * @param submissions every submission of this chore (all kids is fine; the
 *   function applies scope itself). Order does not matter.
 */
export function getChoreState<S extends ScheduleSubmission>(
  chore: ScheduleChore,
  submissions: readonly S[],
  kidId: string,
  now: Date,
  household: ScheduleHousehold,
): ChoreState<S> {
  if (chore.assignee_ids.length > 0 && !chore.assignee_ids.includes(kidId)) {
    return { state: "not_assigned" };
  }

  // Reversed approvals and chores a kid gave up never count, nor does anything finished before a
  // parent's "Make available now" (a pending or sent-back chore still does).
  const resetAt = chore.reset_at ? toDate(chore.reset_at) : undefined;
  const counts = (s: S) =>
    s.status !== "reversed" &&
    s.status !== "withdrawn" &&
    (!resetAt || toDate(s.submitted_at) >= resetAt || s.status === "pending" || s.status === "sent_back");
  const forChore = submissions.filter((s) => s.chore_id === chore.id && counts(s));
  const mine = forChore.filter((s) => s.kid_id === kidId);
  const relevant = chore.scope === "household" ? forChore : mine;
  const latestRelevant = newest(relevant);

  // A sent-back chore always asks this kid to fix it, whatever else is true.
  const sentBack = newest(mine.filter((s) => s.status === "sent_back"));
  if (sentBack) {
    return { state: "needs_fixing", submission: sentBack, latestRelevant };
  }

  const tz = household.timezone;
  const season = seasonWindow(chore, tz);
  // A reset makes the card "New!" again from that moment.
  const createdAt = maxDate(toDate(chore.created_at), resetAt)!;

  // ----- once -------------------------------------------------------------
  if (chore.repeat_kind === "once") {
    const approved = newest(relevant.filter((s) => s.status === "approved"));
    if (approved) {
      return { state: "done_forever", submission: approved, latestRelevant };
    }
    const open = newest(relevant.filter((s) => s.status === "pending"));
    if (open) {
      return open.kid_id === kidId
        ? { state: "pending", submission: open, latestRelevant }
        : { state: "cooldown", submission: open, latestRelevant };
    }
    const lastRejected = newest(relevant.filter((s) => s.status === "rejected"));
    const reopenedAt = lastRejected
      ? toDate(lastRejected.reviewed_at ?? lastRejected.submitted_at)
      : undefined;
    return applySeason(
      { state: "available", becameAvailableAt: maxDate(createdAt, reopenedAt), latestRelevant },
      season,
      now,
    );
  }

  // ----- repeating ----------------------------------------------------------
  if (!latestRelevant) {
    return applySeason({ state: "available", becameAvailableAt: createdAt }, season, now);
  }

  const availableAt = nextAvailableAt(chore, toDate(latestRelevant.submitted_at), household)!;
  if (now < availableAt) {
    if (latestRelevant.kid_id === kidId && latestRelevant.status === "pending") {
      return { state: "pending", submission: latestRelevant, availableAt, latestRelevant };
    }
    return applySeason(
      { state: "cooldown", availableAt, submission: latestRelevant, latestRelevant },
      season,
      now,
    );
  }

  return applySeason(
    { state: "available", becameAvailableAt: maxDate(createdAt, availableAt), latestRelevant },
    season,
    now,
  );
}

/** Seasonal window overrides available/cooldown (SPEC §5 "Seasonal window"). */
function applySeason<S extends ScheduleSubmission>(
  result: ChoreState<S>,
  season: { start?: Date; end?: Date },
  now: Date,
): ChoreState<S> {
  if (season.end && now >= season.end) {
    return { state: "out_of_season", latestRelevant: result.latestRelevant };
  }
  if (season.start && now < season.start) {
    const availableAt = maxDate(season.start, result.availableAt)!;
    if (season.end && availableAt >= season.end) {
      return { state: "out_of_season", latestRelevant: result.latestRelevant };
    }
    return { state: "out_of_season", availableAt, latestRelevant: result.latestRelevant };
  }
  if (result.state === "available" && season.start) {
    return { ...result, becameAvailableAt: maxDate(result.becameAvailableAt, season.start) };
  }
  if (result.state === "cooldown" && season.end && result.availableAt && result.availableAt >= season.end) {
    return { state: "out_of_season", latestRelevant: result.latestRelevant };
  }
  return result;
}

export const NEW_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * "New!" badge: became available in the last 72 hours, or since this kid
 * last opened the board, whichever gives more cards (SPEC §5).
 */
export function isNew(
  state: Pick<ChoreState, "state" | "becameAvailableAt">,
  now: Date,
  kidLastSeenBoardAt: string | Date | null | undefined,
): boolean {
  if (state.state !== "available" || !state.becameAvailableAt) return false;
  const became = state.becameAvailableAt;
  if (became > now) return false;
  if (now.getTime() - became.getTime() <= NEW_WINDOW_MS) return true;
  return kidLastSeenBoardAt ? became > toDate(kidLastSeenBoardAt) : false;
}

/** Show in "Coming back soon" only if it's back within this many days. */
export const COMING_SOON_DAYS = 14;

export type ComingBack =
  | { kind: "tomorrow" }
  | { kind: "weekday"; weekday: number }
  | { kind: "days"; days: number };

/** Kid-friendly "Back tomorrow" / "Back Monday" / "Back in 14 days". */
export function comingBack(availableAt: Date, now: Date, timeZone: string): ComingBack {
  const from: LocalDate = localDateOf(now, timeZone);
  const to: LocalDate = localDateOf(availableAt, timeZone);
  const days = Math.max(1, daysBetween(from, to));
  if (days === 1) return { kind: "tomorrow" };
  if (days < 7) return { kind: "weekday", weekday: dayOfWeek(to) };
  return { kind: "days", days };
}

/**
 * True when a card belongs in "Coming back soon": every cooldown with a known
 * return date, and seasonal chores starting within 14 days.
 */
export function isComingSoon(state: ChoreState, now: Date): boolean {
  if (!state.availableAt) return false;
  if (state.state === "cooldown") return true;
  if (state.state !== "out_of_season") return false;
  return state.availableAt.getTime() - now.getTime() <= COMING_SOON_DAYS * 86_400_000;
}
