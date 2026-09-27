"use client";

/** − [n] + number field. Can be typed into or cleared; `null` means empty (callers block saving). */
export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  disabled = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  label: string;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const btn =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-2xl font-extrabold text-ink ring-1 ring-line active:scale-95 disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Less ${label}`} className={btn} disabled={disabled || (value !== null && value <= min)} onClick={() => onChange(clamp((value ?? min + 1) - 1))}>
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits === "" ? null : Math.min(max, Number(digits)));
        }}
        onBlur={() => {
          if (value !== null && value < min) onChange(min);
        }}
        className={`h-12 w-16 rounded-xl bg-card text-center text-xl font-extrabold text-ink ring-1 outline-none focus:ring-2 focus:ring-amber ${value === null ? "ring-2 ring-maple" : "ring-line"}`}
      />
      <button type="button" aria-label={`More ${label}`} className={btn} disabled={disabled || (value !== null && value >= max)} onClick={() => onChange(clamp((value ?? min - 1) + 1))}>
        +
      </button>
    </div>
  );
}
