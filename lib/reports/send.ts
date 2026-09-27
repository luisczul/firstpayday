import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { buildWeeklyReport, isWeeklyReportDue, type WeeklyReport } from "./weekly";
import { buildWeeklyEmail } from "./weeklyEmail";

type Admin = ReturnType<typeof createAdminClient>;

const WEEK_MS = 7 * 86_400_000;

const HOUSEHOLD_COLUMNS =
  "id, name, locale, currency, timezone, weekly_report_dow, weekly_report_hour, weekly_report_last_sent_at" as const;

interface HouseholdRow {
  id: string;
  name: string;
  locale: string;
  currency: string;
  timezone: string;
  weekly_report_dow: number;
  weekly_report_hour: number;
  weekly_report_last_sent_at: string | null;
}

/** Everything the report counts, for [start, end). Service role: always filtered by household. */
export async function loadWeeklyReport(admin: Admin, householdId: string, start: Date, end: Date): Promise<WeeklyReport> {
  const from = start.toISOString();
  const to = end.toISOString();
  const { data: kids } = await admin
    .from("kids")
    .select("id, name")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  const kidList = kids ?? [];

  const perKid = await Promise.all(
    kidList.map(async (k) => {
      const [{ count }, { data: last }] = await Promise.all([
        admin
          .from("kid_checkins")
          .select("id", { count: "exact", head: true })
          .eq("household_id", householdId)
          .eq("kid_id", k.id)
          .gte("created_at", from)
          .lt("created_at", to),
        admin
          .from("kid_checkins")
          .select("created_at")
          .eq("household_id", householdId)
          .eq("kid_id", k.id)
          .lt("created_at", to)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { id: k.id, count: count ?? 0, last: last?.created_at ?? null };
    }),
  );

  const [{ data: events }, { data: ledger }, { data: emails }] = await Promise.all([
    admin
      .from("submission_events")
      .select("event, submissions!inner(kid_id)")
      .eq("household_id", householdId)
      .gte("created_at", from)
      .lt("created_at", to),
    admin
      .from("ledger_entries")
      .select("kid_id, kind, amount_cents")
      .eq("household_id", householdId)
      .gte("created_at", from)
      .lt("created_at", to),
    admin.from("email_log").select("kind").eq("household_id", householdId).gte("sent_at", from).lt("sent_at", to),
  ]);

  return buildWeeklyReport({
    kids: kidList,
    checkins: perKid.flatMap((k) => Array.from({ length: k.count }, () => ({ kid_id: k.id }))),
    lastCheckinAt: Object.fromEntries(perKid.map((k) => [k.id, k.last])),
    events: (events ?? []).map((e) => ({ event: e.event, kid_id: (e.submissions as unknown as { kid_id: string }).kid_id })),
    ledger: ledger ?? [],
    emails: emails ?? [],
  });
}

async function buildFor(admin: Admin, h: HouseholdRow, now: Date) {
  const start = new Date(now.getTime() - WEEK_MS);
  const report = await loadWeeklyReport(admin, h.id, start, now);
  const email = buildWeeklyEmail({
    locale: h.locale,
    currency: h.currency,
    timezone: h.timezone,
    householdName: h.name,
    report,
    periodStart: start,
    periodEnd: now,
    now,
    dow: h.weekly_report_dow,
    hour: h.weekly_report_hour,
    appUrl: appUrl(),
  });
  return { report, email, html: emailLayout(email.title, email.bodyHtml) };
}

/** Dev preview: the HTML a household would get right now. */
export async function previewWeeklyReportHtml(householdId: string, now = new Date()): Promise<string | null> {
  const admin = createAdminClient();
  const { data: h } = await admin.from("households").select(HOUSEHOLD_COLUMNS).eq("id", householdId).maybeSingle();
  if (!h) return null;
  return (await buildFor(admin, h, now)).html;
}

async function recipients(admin: Admin, householdId: string) {
  const { data: members } = await admin
    .from("household_members")
    .select("user_id, role, weekly_report_enabled")
    .eq("household_id", householdId);
  const opted = (members ?? []).filter((m) => m.weekly_report_enabled && (m.role === "owner" || m.role === "parent"));
  const out: { userId: string; email: string }[] = [];
  for (const m of opted) {
    const email = (await admin.auth.admin.getUserById(m.user_id)).data.user?.email;
    if (email) out.push({ userId: m.user_id, email });
  }
  return out;
}

export interface WeeklyRunResult {
  checked: number;
  due: number;
  sent: number;
  skippedQuiet: number;
}

/**
 * Hourly cron body: for every household whose local day/hour matches its
 * setting, claim the week (conditional update on the stamp we read, so two
 * overlapping runs can't both win), build the report for the last 7 days and
 * email each opted-in parent. Weeks with no activity at all are claimed but
 * not emailed.
 */
export async function runWeeklyReports(now = new Date()): Promise<WeeklyRunResult> {
  const admin = createAdminClient();
  const result: WeeklyRunResult = { checked: 0, due: 0, sent: 0, skippedQuiet: 0 };
  const PAGE = 500;
  for (let offset = 0; ; offset += PAGE) {
    const { data: page, error } = await admin.from("households").select(HOUSEHOLD_COLUMNS).order("id").range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = page ?? [];
    result.checked += rows.length;
    for (const h of rows) {
      if (!isWeeklyReportDue(h, now)) continue;
      result.due++;
      try {
        result.sent += await sendOne(admin, h, now, result);
      } catch (e) {
        console.error("weekly report failed", h.id, e instanceof Error ? e.message : e);
      }
    }
    if (rows.length < PAGE) break;
  }
  return result;
}

async function sendOne(admin: Admin, h: HouseholdRow, now: Date, result: WeeklyRunResult): Promise<number> {
  const claim = admin.from("households").update({ weekly_report_last_sent_at: now.toISOString() }).eq("id", h.id);
  const { data: claimed } = await (h.weekly_report_last_sent_at
    ? claim.eq("weekly_report_last_sent_at", h.weekly_report_last_sent_at)
    : claim.is("weekly_report_last_sent_at", null)
  ).select("id");
  if (!claimed?.length) return 0;
  const release = () =>
    admin
      .from("households")
      .update({ weekly_report_last_sent_at: h.weekly_report_last_sent_at })
      .eq("id", h.id)
      .eq("weekly_report_last_sent_at", now.toISOString());

  const to = await recipients(admin, h.id);
  if (!to.length) return 0;
  const { report, email, html } = await buildFor(admin, h, now);
  if (!report.hasActivity) {
    result.skippedQuiet++;
    return 0;
  }
  let sent = 0;
  for (const r of to) {
    const ok = await sendEmail({ to: r.email, subject: email.subject, html });
    if (!ok) continue;
    sent++;
    await admin.from("email_log").insert({ household_id: h.id, kind: "weekly_report", recipient_user_id: r.userId });
  }
  // Nothing went out (e.g. Resend down): let the next hourly run retry within the catch-up window.
  if (sent === 0) await release();
  return sent;
}
