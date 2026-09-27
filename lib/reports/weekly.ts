// Pure logic for kid check-in stats and the weekly parent report: when it's
// due (household-local day/hour, DST-safe), what it counts, and the email
// HTML. No I/O here so it's unit-testable; lib/reports/send.ts does the rest.
import { fromZonedTime } from "date-fns-tz";
import { addDays, dayOfWeek, localDateOf, type LocalDate } from "@/lib/schedule/tz";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Defaults: Saturday (6) at 12:00 household time. */
export const WEEKLY_REPORT_DEFAULT_DOW = 6;
export const WEEKLY_REPORT_DEFAULT_HOUR = 12;
/** A missed hourly cron run may still send this long after the slot. */
export const WEEKLY_REPORT_CATCHUP_MS = 6 * HOUR_MS;
/** Never two reports closer than this (e.g. after moving the day earlier). */
export const WEEKLY_REPORT_MIN_GAP_MS = 6 * DAY_MS - HOUR_MS;

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** The instant of `hour`:00 local time on `date` (a skipped DST hour rolls forward). */
export function localHourInstant(date: LocalDate, hour: number, timeZone: string): Date {
  return fromZonedTime(`${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}T${pad(hour)}:00:00`, timeZone);
}

/** The most recent scheduled slot at or before `now`. */
export function latestWeeklySlot(now: Date, timeZone: string, dow: number, hour: number): Date {
  const today = localDateOf(now, timeZone);
  const back = (dayOfWeek(today) - dow + 7) % 7;
  let slot = localHourInstant(addDays(today, -back), hour, timeZone);
  if (slot.getTime() > now.getTime()) slot = localHourInstant(addDays(today, -back - 7), hour, timeZone);
  return slot;
}

export interface WeeklySchedule {
  timezone: string;
  weekly_report_dow: number;
  weekly_report_hour: number;
  weekly_report_last_sent_at: string | null;
}

/**
 * Due when this week's slot has passed (within the catch-up window) and no
 * report went out for it. Uses real instants, so DST shifts can't skip or
 * double a week.
 */
export function isWeeklyReportDue(h: WeeklySchedule, now: Date): boolean {
  let slot: Date;
  try {
    slot = latestWeeklySlot(now, h.timezone, h.weekly_report_dow, h.weekly_report_hour);
  } catch {
    return false;
  }
  if (Number.isNaN(slot.getTime())) return false;
  const since = now.getTime() - slot.getTime();
  if (since < 0 || since >= WEEKLY_REPORT_CATCHUP_MS) return false;
  if (!h.weekly_report_last_sent_at) return true;
  const last = new Date(h.weekly_report_last_sent_at).getTime();
  if (Number.isNaN(last)) return true;
  return last < slot.getTime() && now.getTime() - last >= WEEKLY_REPORT_MIN_GAP_MS;
}

// ---------------------------------------------------------------------------
// Check-in stats (admin kid page)
// ---------------------------------------------------------------------------

export interface CheckinStats {
  last7: number;
  last30: number;
  total: number;
  lastAt: string | null;
  /** Oldest first; per local day for the last 14 days, today last. */
  perDay: { date: LocalDate; count: number }[];
  /** 0 = Sunday; null when there's nothing to go on. */
  busiestDow: number | null;
  /** 0..23 local hour; null when there's nothing to go on. */
  busiestHour: number | null;
}

// Explicit "timeZone: zone" on purpose: the production minifier mangles a shorthand { timeZone } when it inlines this helper.
function localHour(instant: Date, zone: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(instant);
  return Number(h) % 24;
}

const sameDay = (a: LocalDate, b: LocalDate) => a.year === b.year && a.month === b.month && a.day === b.day;

function argmax(counts: number[]): number | null {
  let best = -1;
  let at: number | null = null;
  counts.forEach((c, i) => {
    if (c > best && c > 0) {
      best = c;
      at = i;
    }
  });
  return at;
}

/** `recent`: check-in timestamps from (at least) the last 30 days; `total`: all-time count. */
export function checkinStats(recent: readonly string[], total: number, now: Date, timeZone: string): CheckinStats {
  const t = now.getTime();
  const times = recent.map((s) => new Date(s)).filter((d) => !Number.isNaN(d.getTime()) && d.getTime() <= t);
  const today = localDateOf(now, timeZone);
  const perDay = Array.from({ length: 14 }, (_, i) => ({ date: addDays(today, i - 13), count: 0 }));
  const byDow = Array<number>(7).fill(0);
  const byHour = Array<number>(24).fill(0);
  let last7 = 0;
  let last30 = 0;
  let lastAt: number | null = null;
  for (const d of times) {
    const age = t - d.getTime();
    if (age < 7 * DAY_MS) last7++;
    if (age < 30 * DAY_MS) {
      last30++;
      byDow[dayOfWeek(localDateOf(d, timeZone))]!++;
      byHour[localHour(d, timeZone)]!++;
    }
    const local = localDateOf(d, timeZone);
    const slot = perDay.find((p) => sameDay(p.date, local));
    if (slot) slot.count++;
    if (lastAt === null || d.getTime() > lastAt) lastAt = d.getTime();
  }
  return {
    last7,
    last30,
    total: Math.max(total, last30),
    lastAt: lastAt === null ? null : new Date(lastAt).toISOString(),
    perDay,
    busiestDow: argmax(byDow),
    busiestHour: argmax(byHour),
  };
}

const INTL: Record<string, string> = { en: "en-CA", fr: "fr-CA", es: "es-419", pt: "pt-BR" };
export const intlTag = (locale: string) => INTL[locale] ?? "en-CA";

/** "2 hours ago", "yesterday", "1 minute ago" (never a bare "now"). */
export function timeAgo(iso: string, now: Date, locale = "en"): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(intlTag(locale), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60_000) return rtf.format(diff > 0 ? 1 : -1, "minute");
  if (abs < HOUR_MS) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < DAY_MS) return rtf.format(Math.round(diff / HOUR_MS), "hour");
  if (abs < 30 * DAY_MS) return rtf.format(Math.round(diff / DAY_MS), "day");
  if (abs < 365 * DAY_MS) return rtf.format(Math.round(diff / (30 * DAY_MS)), "month");
  return rtf.format(Math.round(diff / (365 * DAY_MS)), "year");
}

/** "3 PM" / "15 h" style hour label. */
export function hourLabel(hour: number, locale = "en"): string {
  // pt-BR Intl gives a bare "12"; Brazilians write "12h".
  if (locale === "pt") return `${hour}h`;
  return new Intl.DateTimeFormat(intlTag(locale), { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4, hour)));
}

export function weekdayLabel(dow: number, locale = "en", style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat(intlTag(locale), { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + dow)));
}

// ---------------------------------------------------------------------------
// Weekly report aggregation
// ---------------------------------------------------------------------------

export interface ReportKid {
  id: string;
  name: string;
}
export interface ReportEvent {
  kid_id: string;
  event: string;
}
export interface ReportLedger {
  kid_id: string;
  kind: string;
  amount_cents: number;
}
export interface ReportInput {
  kids: readonly ReportKid[];
  /** Check-ins inside the period. */
  checkins: readonly { kid_id: string }[];
  /** Most recent check-in per kid, any time. */
  lastCheckinAt: Readonly<Record<string, string | null | undefined>>;
  /** submission_events inside the period, with the submission's kid. */
  events: readonly ReportEvent[];
  /** ledger_entries inside the period. */
  ledger: readonly ReportLedger[];
  /** email_log rows inside the period. */
  emails: readonly { kind: string }[];
}

export interface KidReport {
  id: string;
  name: string;
  checkins: number;
  lastCheckinAt: string | null;
  approved: number;
  submitted: number;
  resubmitted: number;
  sentBack: number;
  reversed: number;
  rejected: number;
  /** Chore pay (earning rows). */
  earnedCents: number;
  bonusCents: number;
  matchCents: number;
  /** Net manual adjustments and undos (usually <= 0). */
  adjustmentCents: number;
  /** Paid out, as a positive number. */
  paidOutCents: number;
}

export interface WeeklyReport {
  kids: KidReport[];
  totals: Omit<KidReport, "id" | "name" | "lastCheckinAt">;
  reviewEmailsSent: number;
  /** Anything at all happened this week. */
  hasActivity: boolean;
}

export function buildWeeklyReport(input: ReportInput): WeeklyReport {
  const kids: KidReport[] = input.kids.map((k) => ({
    id: k.id,
    name: k.name,
    checkins: 0,
    lastCheckinAt: input.lastCheckinAt[k.id] ?? null,
    approved: 0,
    submitted: 0,
    resubmitted: 0,
    sentBack: 0,
    reversed: 0,
    rejected: 0,
    earnedCents: 0,
    bonusCents: 0,
    matchCents: 0,
    adjustmentCents: 0,
    paidOutCents: 0,
  }));
  const byId = new Map(kids.map((k) => [k.id, k]));
  for (const c of input.checkins) {
    const k = byId.get(c.kid_id);
    if (k) k.checkins++;
  }
  for (const e of input.events) {
    const k = byId.get(e.kid_id);
    if (!k) continue;
    if (e.event === "approved") k.approved++;
    else if (e.event === "submitted") k.submitted++;
    else if (e.event === "resubmitted") k.resubmitted++;
    else if (e.event === "sent_back" || e.event === "reopened") k.sentBack++;
    else if (e.event === "reversed") k.reversed++;
    else if (e.event === "rejected") k.rejected++;
  }
  for (const l of input.ledger) {
    const k = byId.get(l.kid_id);
    if (!k) continue;
    if (l.kind === "earning") k.earnedCents += l.amount_cents;
    else if (l.kind === "bonus" || l.kind === "promo") k.bonusCents += l.amount_cents;
    else if (l.kind === "match") k.matchCents += l.amount_cents;
    else if (l.kind === "adjustment") k.adjustmentCents += l.amount_cents;
    else if (l.kind === "payout") k.paidOutCents += -l.amount_cents;
  }
  const keys = [
    "checkins",
    "approved",
    "submitted",
    "resubmitted",
    "sentBack",
    "reversed",
    "rejected",
    "earnedCents",
    "bonusCents",
    "matchCents",
    "adjustmentCents",
    "paidOutCents",
  ] as const;
  const totals = Object.fromEntries(keys.map((key) => [key, kids.reduce((s, k) => s + k[key], 0)])) as WeeklyReport["totals"];
  const reviewEmailsSent = input.emails.filter((e) => e.kind === "review_ready").length;
  const hasActivity = keys.some((key) => totals[key] !== 0);
  return { kids, totals, reviewEmailsSent, hasActivity };
}
