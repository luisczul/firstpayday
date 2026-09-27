import { describe, expect, it } from "vitest";
import { buildWeeklyReport, checkinStats, isWeeklyReportDue, latestWeeklySlot, timeAgo, type WeeklySchedule } from "./weekly";
import { buildWeeklyEmail } from "./weeklyEmail";

const TZ = "America/Toronto";
const sched = (over: Partial<WeeklySchedule> = {}): WeeklySchedule => ({
  timezone: TZ,
  weekly_report_dow: 6,
  weekly_report_hour: 12,
  weekly_report_last_sent_at: null,
  ...over,
});

describe("weekly report schedule", () => {
  // Sat 2026-09-26 12:00 EDT = 16:00Z.
  const satNoon = new Date("2026-09-26T16:00:00Z");

  it("is due at the household's local day/hour (default Saturday noon)", () => {
    expect(isWeeklyReportDue(sched(), satNoon)).toBe(true);
    expect(isWeeklyReportDue(sched(), new Date("2026-09-26T16:05:00Z"))).toBe(true);
    // 11:00 local: not yet.
    expect(isWeeklyReportDue(sched(), new Date("2026-09-26T15:00:00Z"))).toBe(false);
    // Friday noon: wrong day.
    expect(isWeeklyReportDue(sched(), new Date("2026-09-25T16:00:00Z"))).toBe(false);
  });

  it("catches up a missed run for a few hours, then gives up until next week", () => {
    expect(isWeeklyReportDue(sched(), new Date("2026-09-26T21:00:00Z"))).toBe(true); // 17:00 local
    expect(isWeeklyReportDue(sched(), new Date("2026-09-26T22:00:00Z"))).toBe(false); // 18:00 local
  });

  it("never sends twice for the same week", () => {
    const sent = sched({ weekly_report_last_sent_at: "2026-09-26T16:00:30Z" });
    expect(isWeeklyReportDue(sent, new Date("2026-09-26T17:00:00Z"))).toBe(false);
    // Next Saturday it's due again.
    expect(isWeeklyReportDue(sent, new Date("2026-10-03T16:00:00Z"))).toBe(true);
  });

  it("moving the day earlier right after a send waits for the following week", () => {
    const sent = sched({ weekly_report_last_sent_at: "2026-09-26T16:00:00Z", weekly_report_dow: 0, weekly_report_hour: 9 });
    // Sun 2026-09-27 09:00 local: only 21h after the last report.
    expect(isWeeklyReportDue(sent, new Date("2026-09-27T13:00:00Z"))).toBe(false);
    expect(isWeeklyReportDue(sent, new Date("2026-10-04T13:00:00Z"))).toBe(true);
  });

  it("uses the household timezone, not UTC", () => {
    const paris = sched({ timezone: "Europe/Paris" });
    // Sat 12:00 in Paris (CEST, UTC+2) = 10:00Z.
    expect(isWeeklyReportDue(paris, new Date("2026-09-26T10:00:00Z"))).toBe(true);
    expect(isWeeklyReportDue(paris, satNoon)).toBe(false);
  });

  it("is DST-safe: the week across the fall-back change is sent once, at local noon", () => {
    // Toronto falls back Sun 2026-11-01. Sat 10-31 noon EDT = 16:00Z; Sat 11-07 noon EST = 17:00Z.
    const last = sched({ weekly_report_last_sent_at: "2026-10-31T16:00:00Z" });
    expect(isWeeklyReportDue(last, new Date("2026-11-07T16:00:00Z"))).toBe(false); // 11:00 EST
    expect(isWeeklyReportDue(last, new Date("2026-11-07T17:00:00Z"))).toBe(true);
    expect(latestWeeklySlot(new Date("2026-11-07T17:30:00Z"), TZ, 6, 12).toISOString()).toBe("2026-11-07T17:00:00.000Z");
  });

  it("a skipped spring-forward hour still sends that day", () => {
    // Toronto springs forward Sun 2027-03-14 at 02:00 -> 03:00. A 2 AM Sunday report goes out at 03:00 EDT (07:00Z).
    const s = sched({ weekly_report_dow: 0, weekly_report_hour: 2 });
    expect(isWeeklyReportDue(s, new Date("2027-03-14T07:00:00Z"))).toBe(true);
  });

  it("an invalid timezone is never due (and doesn't throw)", () => {
    expect(isWeeklyReportDue(sched({ timezone: "Not/AZone" }), satNoon)).toBe(false);
  });
});

describe("check-in stats", () => {
  const now = new Date("2026-09-26T16:00:00Z"); // Sat noon Toronto
  it("counts windows, last check-in, per-day bars and busiest slot", () => {
    const s = checkinStats(
      [
        "2026-09-26T14:00:00Z", // Sat 10:00
        "2026-09-26T14:30:00Z", // Sat 10:30
        "2026-09-24T21:00:00Z", // Thu 17:00
        "2026-09-12T14:00:00Z", // Sat 10:00, 14 days ago (outside the 14-day bars)
      ],
      40,
      now,
      TZ,
    );
    expect(s.last7).toBe(3);
    expect(s.last30).toBe(4);
    expect(s.total).toBe(40);
    expect(s.lastAt).toBe("2026-09-26T14:30:00.000Z");
    expect(s.perDay).toHaveLength(14);
    expect(s.perDay.at(-1)).toEqual({ date: { year: 2026, month: 9, day: 26 }, count: 2 });
    expect(s.perDay.at(-3)?.count).toBe(1);
    expect(s.perDay.reduce((a, d) => a + d.count, 0)).toBe(3);
    expect(s.busiestDow).toBe(6);
    expect(s.busiestHour).toBe(10);
  });

  it("empty history", () => {
    const s = checkinStats([], 0, now, TZ);
    expect(s).toMatchObject({ last7: 0, last30: 0, total: 0, lastAt: null, busiestDow: null, busiestHour: null });
  });

  it("uses local days: 23:30 local stays on that day", () => {
    const s = checkinStats(["2026-09-26T03:30:00Z"], 1, now, TZ); // Fri 23:30 EDT
    expect(s.perDay.at(-2)?.count).toBe(1);
    expect(s.busiestDow).toBe(5);
  });

  it("timeAgo", () => {
    expect(timeAgo("2026-09-26T14:00:00Z", now)).toBe("2 hours ago");
    expect(timeAgo("2026-09-26T15:59:30Z", now)).toBe("1 minute ago");
    expect(timeAgo("2026-09-25T16:00:00Z", now)).toBe("yesterday");
  });
});

describe("weekly report aggregation", () => {
  const input = {
    kids: [
      { id: "a", name: "Liam" },
      { id: "b", name: "Camila" },
    ],
    checkins: [{ kid_id: "a" }, { kid_id: "a" }, { kid_id: "b" }, { kid_id: "zzz" }],
    lastCheckinAt: { a: "2026-09-26T14:00:00Z" },
    events: [
      { kid_id: "a", event: "submitted" },
      { kid_id: "a", event: "approved" },
      { kid_id: "a", event: "reopened" },
      { kid_id: "a", event: "resubmitted" },
      { kid_id: "a", event: "approved" },
      { kid_id: "b", event: "submitted" },
      { kid_id: "b", event: "sent_back" },
      { kid_id: "b", event: "reversed" },
      { kid_id: "b", event: "rejected" },
    ],
    ledger: [
      { kid_id: "a", kind: "earning", amount_cents: 500 },
      { kid_id: "a", kind: "bonus", amount_cents: 100 },
      { kid_id: "a", kind: "match", amount_cents: 250 },
      { kid_id: "a", kind: "adjustment", amount_cents: -500 },
      { kid_id: "a", kind: "earning", amount_cents: 500 },
      { kid_id: "a", kind: "payout", amount_cents: -300 },
    ],
    emails: [{ kind: "review_ready" }, { kind: "review_ready" }, { kind: "weekly_report" }],
  };

  it("counts per kid and in total", () => {
    const r = buildWeeklyReport(input);
    const liam = r.kids[0]!;
    expect(liam).toMatchObject({
      checkins: 2,
      lastCheckinAt: "2026-09-26T14:00:00Z",
      approved: 2,
      submitted: 1,
      resubmitted: 1,
      sentBack: 1,
      earnedCents: 1000,
      bonusCents: 100,
      matchCents: 250,
      adjustmentCents: -500,
      paidOutCents: 300,
    });
    expect(r.kids[1]).toMatchObject({ checkins: 1, lastCheckinAt: null, sentBack: 1, reversed: 1, rejected: 1, approved: 0 });
    expect(r.totals.checkins).toBe(3);
    expect(r.totals.approved).toBe(2);
    expect(r.totals.submitted).toBe(2);
    expect(r.reviewEmailsSent).toBe(2);
    expect(r.hasActivity).toBe(true);
  });

  it("a quiet week has no activity", () => {
    const r = buildWeeklyReport({ ...input, checkins: [], events: [], ledger: [], emails: [] });
    expect(r.hasActivity).toBe(false);
    expect(r.totals.approved).toBe(0);
  });

  it("renders a localized email with the report numbers and a plain /admin link", () => {
    const report = buildWeeklyReport(input);
    const base = {
      currency: "CAD",
      timezone: TZ,
      householdName: "Rev <family>",
      report,
      periodStart: new Date("2026-09-19T16:00:00Z"),
      periodEnd: new Date("2026-09-26T16:00:00Z"),
      now: new Date("2026-09-26T16:00:00Z"),
      dow: 6,
      hour: 12,
      appUrl: "https://firstpayday.app",
    };
    const en = buildWeeklyEmail({ ...base, locale: "en" });
    expect(en.subject).toContain("2 chores approved");
    expect(en.subject).toContain("$13.50");
    expect(en.bodyHtml).toContain('href="https://firstpayday.app/admin"');
    expect(en.bodyHtml).not.toContain("token");
    expect(en.bodyHtml).toContain("Rev &lt;family&gt;");
    expect(en.bodyHtml).not.toContain("<family>");
    expect(en.bodyHtml).toContain("Open First Payday");
    expect(en.bodyHtml).toContain("2 “ready for review” emails");
    expect(en.bodyHtml).toContain("Saturday");
    expect(en.bodyHtml).toContain("last 2 hours ago");

    const fr = buildWeeklyEmail({ ...base, locale: "fr" });
    expect(fr.title).toBe("Votre rapport de la semaine");
    expect(fr.bodyHtml).toContain("Ouvrir First Payday");
    expect(fr.bodyHtml).toContain("samedi");

    // Unknown locales fall back to English.
    expect(buildWeeklyEmail({ ...base, locale: "xx" }).title).toBe("Your weekly report");
  });
});
