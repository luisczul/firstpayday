"use client";

import { useState } from "react";

/** History's From / To filters: "To" can't be set before "From" (that range has no rows). */
export function DateRange({
  from: initialFrom,
  to: initialTo,
  labels,
  className,
}: {
  from?: string;
  to?: string;
  labels: { from: string; to: string };
  className: string;
}) {
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  return (
    <>
      {/* Visible labels: an empty date box shows nothing at all in Android web views. */}
      <label className="flex flex-col gap-0.5 text-xs font-bold text-ink-soft">
        📅 {labels.from}
        <input
          type="date"
          name="from"
          value={from}
          max={to || undefined}
          onChange={(e) => {
            const v = e.target.value;
            setFrom(v);
            // Moving From past To drags To along, instead of leaving an empty range.
            if (v && to && to < v) setTo(v);
          }}
          className={className}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-xs font-bold text-ink-soft">
        📅 {labels.to}
        <input
          type="date"
          name="to"
          value={to}
          min={from || undefined}
          onChange={(e) => {
            const v = e.target.value;
            // iOS date wheels ignore min, so an earlier day is moved up to From.
            setTo(v && from && v < from ? from : v);
          }}
          className={className}
        />
      </label>
    </>
  );
}
