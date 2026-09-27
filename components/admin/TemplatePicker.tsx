"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, NAMED_INTERVALS, REPEAT_PRESETS, type ChoreTemplate } from "@/lib/templates";
import { amountInput, formatPrice, parseMoneyToCents } from "@/lib/money/format";
import { Button } from "@/components/ui";
import { asLocale, type Locale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";

export interface TemplateSelection {
  key: string;
  price_cents: number;
  repeat_kind: "once" | "daily" | "weekly" | "every_n_days";
  repeat_every_days: number | null;
}

type RepeatValue = "once" | "daily" | "weekly" | `n${number}`;

const REPEAT_WORDS: Record<Locale, { once: string; daily: string; weekly: string; every: (n: number | null) => string }> = {
  en: { once: "Once", daily: "Daily", weekly: "Weekly", every: (n) => `Every ${n} days` },
  fr: { once: "Une fois", daily: "Chaque jour", weekly: "Chaque semaine", every: (n) => `Aux ${n} jours` },
  es: { once: "Una vez", daily: "Cada día", weekly: "Cada semana", every: (n) => `Cada ${n} días` },
  pt: { once: "Uma vez", daily: "Todo dia", weekly: "Toda semana", every: (n) => `A cada ${n} dias` },
};

export function repeatLabel(kind: string, n: number | null, locale: Locale = "en"): string {
  const w = REPEAT_WORDS[locale] ?? REPEAT_WORDS.en;
  if (kind === "once") return w.once;
  if (kind === "daily") return w.daily;
  if (kind === "weekly") return w.weekly;
  if (n && NAMED_INTERVALS[n]) return NAMED_INTERVALS[n]![locale] ?? NAMED_INTERVALS[n]!.en;
  return w.every(n);
}

const toValue = (kind: string, n: number | null): RepeatValue =>
  kind === "every_n_days" ? `n${n ?? 7}` : (kind as RepeatValue);

/**
 * All templates pre-selected, grouped by category, with inline price and
 * repeat edits (SPEC §9 step 4). Also opened from Admin → Chores.
 */
export function TemplatePicker({
  templates,
  currency,
  locale,
  excludeKeys = [],
  submitLabel,
  busy,
  onSubmit,
}: {
  templates: ChoreTemplate[];
  currency: string;
  locale: Locale;
  excludeKeys?: string[];
  submitLabel: string;
  busy?: boolean;
  onSubmit: (picks: TemplateSelection[]) => void;
}) {
  const available = useMemo(() => templates.filter((t) => !excludeKeys.includes(t.key)), [templates, excludeKeys]);
  const [state, setState] = useState<Record<string, TemplateSelection & { on: boolean }>>(() =>
    Object.fromEntries(
      available.map((t) => [
        t.key,
        {
          key: t.key,
          on: excludeKeys.length === 0,
          price_cents: t.price_cents,
          repeat_kind: t.repeat_kind as TemplateSelection["repeat_kind"],
          repeat_every_days: t.repeat_every_days,
        },
      ]),
    ),
  );

  const update = (key: string, patch: Partial<TemplateSelection & { on: boolean }>) =>
    setState((s) => ({ ...s, [key]: { ...s[key]!, ...patch } }));

  const selected = Object.values(state).filter((s) => s.on);
  // Also used by onboarding, so the locale comes from props rather than the admin provider.
  const tr = parentT(locale);

  return (
    <div className="flex flex-col gap-8">
      {CATEGORIES.map((cat) => {
        const items = available.filter((t) => t.category === cat);
        if (items.length === 0) return null;
        const allOn = items.every((t) => state[t.key]?.on);
        return (
          <section key={cat}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-ink">{CATEGORY_LABELS[cat]?.[locale] ?? cat}</h3>
              <button
                type="button"
                className="min-h-9 rounded-lg px-2 text-sm font-bold text-maple"
                onClick={() => items.forEach((t) => update(t.key, { on: !allOn }))}
              >
                {allOn ? tr("b.tpl.selectNone") : tr("b.tpl.selectAll")}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => {
                const s = state[t.key]!;
                return (
                  <div
                    key={t.key}
                    className={`relative overflow-hidden rounded-2xl bg-card p-4 pl-6 ring-2 transition ${
                      s.on ? "ring-moss shadow-[var(--shadow-card)]" : "opacity-55 ring-line"
                    }`}
                  >
                    <span aria-hidden className={`absolute inset-y-0 left-0 w-2 ${Array.isArray(t.subtasks) && t.subtasks.length ? "bg-plum" : "bg-amber"}`} />
                    <button
                      type="button"
                      onClick={() => update(t.key, { on: !s.on })}
                      className="flex w-full items-start gap-3 text-left"
                      aria-pressed={s.on}
                    >
                      <span className="text-3xl" aria-hidden>{t.emoji}</span>
                      <span className="flex-1">
                        <span className="block font-display text-lg font-bold leading-tight text-ink">{t.title}</span>
                        <span className="mt-1 line-clamp-2 block text-sm text-ink-soft">{t.description}</span>
                        {Array.isArray(t.subtasks) && t.subtasks.length ? (
                          <span className="mt-1 inline-block rounded-full bg-plum/15 px-2 py-0.5 text-xs font-bold text-plum">
                            🔁 {tr("b.routine.label")} · {tr(t.subtasks.length === 1 ? "b.chores.stepOne" : "b.chores.stepMany", { n: t.subtasks.length })}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          s.on ? "bg-moss text-white" : "bg-paper-deep text-transparent"
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                    </button>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <PriceInput
                        cents={s.price_cents}
                        currency={currency}
                        locale={locale}
                        onChange={(c) => update(t.key, { price_cents: c })}
                      />
                      {t.unit_label ? <span className="text-xs font-bold text-ink-soft">/ {t.unit_label} ×{t.max_quantity}</span> : null}
                      <select
                        aria-label={tr("b.tpl.repeat")}
                        value={toValue(s.repeat_kind, s.repeat_every_days)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v.startsWith("n")) update(t.key, { repeat_kind: "every_n_days", repeat_every_days: Number(v.slice(1)) });
                          else update(t.key, { repeat_kind: v as TemplateSelection["repeat_kind"], repeat_every_days: null });
                        }}
                        className="min-h-9 rounded-full border border-line bg-paper px-3 text-sm font-bold text-ink outline-none focus:border-amber focus:ring-2 focus:ring-amber/40"
                      >
                        <option value="once">{repeatLabel("once", null, locale)}</option>
                        <option value="daily">{repeatLabel("daily", null, locale)}</option>
                        <option value="weekly">{repeatLabel("weekly", null, locale)}</option>
                        {[...new Set([...REPEAT_PRESETS, t.repeat_every_days ?? 14, 90])]
                          .sort((a, b) => a - b)
                          .map((n) => (
                            <option key={n} value={`n${n}`}>
                              {repeatLabel("every_n_days", n, locale)}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <span className="font-bold text-ink-soft">{tr("b.tpl.selected", { n: selected.length })}</span>
        <Button
          size="lg"
          disabled={busy}
          onClick={() => onSubmit(selected.map(({ on: _on, ...rest }) => rest))}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function PriceInput({
  cents,
  currency,
  locale,
  onChange,
  autoFocus,
}: {
  cents: number;
  currency: string;
  locale: string;
  onChange: (cents: number) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(amountInput(cents, locale, true));
  const [bad, setBad] = useState(false);
  const tr = parentT(asLocale(locale));
  return (
    <span className="inline-flex items-center rounded-full bg-gold/60 pl-3 font-black text-ink ring-amber focus-within:ring-2">
      <span aria-hidden>{formatPrice(0, currency, locale).replace(/[\d.,\s]/g, "") || "$"}</span>
      <input
        inputMode="decimal"
        aria-label={tr("b.tpl.price")}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const c = parseMoneyToCents(e.target.value);
          setBad(c === null || c < 0);
          if (c !== null && c >= 0) onChange(c);
        }}
        className={`min-h-9 w-16 rounded-full bg-transparent px-1 text-base font-black outline-none ${bad ? "text-danger" : ""}`}
      />
    </span>
  );
}
