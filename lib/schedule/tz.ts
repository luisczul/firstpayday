import { fromZonedTime } from "date-fns-tz";

/** A calendar date in some timezone (month is 1-based). */
export interface LocalDate {
  year: number;
  month: number;
  day: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

// Explicit "timeZone: zone" on purpose: the production minifier mangles a shorthand { timeZone } when it inlines this helper.
function formatterFor(zone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    partsFormatters.set(zone, f);
  }
  return f;
}

/** The calendar date that `instant` falls on in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Parse a Postgres `date` string (YYYY-MM-DD). */
export function parseLocalDate(value: string): LocalDate {
  const [y, m, d] = value.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

/** Pure calendar arithmetic; DST never affects whole days on a calendar. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const t = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/** Whole calendar days from a to b (b - a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** The instant of local midnight (start of day) for `date` in `timeZone`. */
export function startOfLocalDay(date: LocalDate, timeZone: string): Date {
  return fromZonedTime(`${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}T00:00:00`, timeZone);
}

/** The instant a wall-clock date ("YYYY-MM-DD") and time ("HH:MM") happen in `timeZone`. */
export function zonedDateTimeToInstant(date: string, time: string, timeZone: string): Date {
  return fromZonedTime(`${date}T${time}:00`, timeZone);
}

/** Wall-clock date ("YYYY-MM-DD") and time ("HH:MM", 24h) of `instant` in `timeZone`. */
export function instantToZonedDateTime(instant: Date, zone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
