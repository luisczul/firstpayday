"use client";

import { translator, type Locale } from "@/lib/i18n";

/** "☑ 2/3 steps" with a chunky progress bar (checklist chore cards and sheet). */
export function ChecklistProgress({
  done,
  total,
  locale,
  size = "md",
}: {
  done: number;
  total: number;
  locale: Locale;
  size?: "md" | "lg";
}) {
  const tr = translator(locale);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <span className="flex flex-col gap-1.5" data-testid="checklist-progress">
      <span className={`font-extrabold ${complete ? "text-moss" : "text-ink"} ${size === "lg" ? "text-2xl" : "text-lg"}`}>
        ☑ {tr("kid.steps", { done, total })}
      </span>
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={tr("kid.steps", { done, total })}
        className={`block w-full overflow-hidden rounded-full bg-paper-deep ${size === "lg" ? "h-5" : "h-3.5"}`}
      >
        <span
          className={`block h-full rounded-full transition-[width] duration-300 ${complete ? "bg-moss" : "bg-amber"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}
