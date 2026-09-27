import { Card } from "@/components/ui";
import { hourLabel, timeAgo, weekdayLabel, type CheckinStats as Stats } from "@/lib/reports/weekly";
import { asLocale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";
import { rich } from "@/lib/i18n/parent/rich";

/** Kid page: how often this kid opens their board on the tablet. */
export function CheckinStats({ stats, now, locale }: { stats: Stats; now: Date; locale: string }) {
  const max = Math.max(1, ...stats.perDay.map((d) => d.count));
  const t = parentT(asLocale(locale));
  const plural = (n: number) => t(n === 1 ? "a.checkins.n.one" : "a.checkins.n.other", { n });
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-xl font-bold">{t("a.checkins.title")}</h2>
        <p className="text-sm text-ink-soft" data-testid="last-checkin">
          {stats.lastAt ? t("a.checkins.summary", { count: plural(stats.total), when: timeAgo(stats.lastAt, now, locale) }) : t("a.checkins.never")}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [t("a.checkins.last7"), stats.last7],
          [t("a.checkins.last30"), stats.last30],
          [t("a.checkins.allTime"), stats.total],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl bg-paper-deep/60 px-2 py-3">
            <p className="font-display text-2xl font-bold text-ink">{n}</p>
            <p className="text-xs font-bold text-ink-soft">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-1 text-xs font-bold text-ink-soft">{t("a.checkins.last14")}</p>
        <div className="flex h-16 items-end gap-1" role="img" aria-label={t("a.checkins.perDayAria", { list: stats.perDay.map((d) => d.count).join(", ") })}>
          {stats.perDay.map((d, i) => (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.date.month}/${d.date.day}: ${plural(d.count)}`}>
              <div
                className={`w-full rounded-t ${d.count ? "bg-amber" : "bg-line"}`}
                style={{ height: d.count ? `${Math.max(12, (d.count / max) * 100)}%` : "4px" }}
              />
            </div>
          ))}
        </div>
      </div>

      {stats.busiestDow !== null && stats.busiestHour !== null ? (
        <p className="mt-3 text-sm text-ink-soft">
          {rich(t("a.checkins.usually"), {
            day: <span className="font-bold text-ink">{t("a.checkins.dayPlural", { day: weekdayLabel(stats.busiestDow, locale) })}</span>,
            hour: <span className="font-bold text-ink">{hourLabel(stats.busiestHour, locale)}</span>,
          })}
        </p>
      ) : null}
    </Card>
  );
}
