"use client";

import { useMemo, useState } from "react";
import { BLANK_CHORE, type EditableChore } from "@/components/admin/ChoreEditor";
import { repeatLabel } from "@/components/admin/TemplatePicker";
import { Badge, Button } from "@/components/ui";
import { formatPrice } from "@/lib/money/format";
import { parseSubtasks } from "@/lib/schedule/checklist";
import { CATEGORIES, CATEGORY_LABELS, seasonWindow, type ChoreTemplate } from "@/lib/templates";
import type { Locale } from "@/lib/i18n";
import { useParentT } from "@/lib/i18n/parent/client";

/** A template as a new, unsaved chore the parent can tweak (template_key kept so its translations are reused). */
export function templateToEditable(t: ChoreTemplate, today: Date): EditableChore {
  return {
    ...BLANK_CHORE,
    title: t.title,
    description: t.description ?? "",
    emoji: t.emoji ?? BLANK_CHORE.emoji,
    price_cents: t.price_cents,
    unit_label: t.unit_label,
    max_quantity: t.max_quantity,
    repeat_kind: t.repeat_kind as EditableChore["repeat_kind"],
    repeat_every_days: t.repeat_every_days,
    scope: t.scope as EditableChore["scope"],
    category: t.category ?? "other",
    subtasks: parseSubtasks(t.subtasks),
    ...seasonWindow(t.season, today),
    template_key: t.key,
  };
}

/** "New chore → Start from a template": pick ONE template to open pre-filled in the editor. */
export function TemplateChooser({
  templates,
  onBoardKeys,
  currency,
  locale,
  onPick,
  onBack,
}: {
  templates: ChoreTemplate[];
  onBoardKeys: string[];
  currency: string;
  locale: Locale;
  onPick: (t: ChoreTemplate) => void;
  onBack: () => void;
}) {
  const tr = useParentT();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const cats = useMemo(() => CATEGORIES.filter((c) => templates.some((t) => (t.category ?? "other") === c)), [templates]);
  const q = query.trim().toLowerCase();
  const shown = templates.filter(
    (t) =>
      (!category || (t.category ?? "other") === category) &&
      (!q || t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q)),
  );
  const steps = (t: ChoreTemplate) => parseSubtasks(t.subtasks).length;
  const routines = shown.filter((t) => steps(t) > 0);
  const chores = shown.filter((t) => steps(t) === 0);

  const row = (t: ChoreTemplate) => {
    const n = steps(t);
    return (
      <li key={t.key}>
        <button
          type="button"
          onClick={() => onPick(t)}
          className={`flex w-full items-start gap-3 rounded-2xl bg-card p-4 text-left ring-1 hover:ring-2 hover:ring-amber ${
            n ? "border-l-[6px] border-plum ring-plum/30" : "ring-line"
          }`}
        >
          <span className="text-3xl" aria-hidden>{t.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold leading-tight text-ink">{t.title}</span>
            <span className="mt-0.5 line-clamp-2 block text-sm text-ink-soft">{t.description}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <span className="rounded-full bg-gold/60 px-2 py-0.5 text-ink">
                {formatPrice(t.price_cents, currency, locale)}
                {t.unit_label ? ` / ${t.unit_label}` : ""}
              </span>
              <span className="text-ink-soft">{repeatLabel(t.repeat_kind, t.repeat_every_days, locale)}</span>
              {n ? (
                <span className="rounded-full bg-plum/15 px-2 py-0.5 text-plum">
                  🔁 {tr("b.routine.label")} · {tr(n === 1 ? "b.chores.stepOne" : "b.chores.stepMany", { n })}
                </span>
              ) : null}
              {onBoardKeys.includes(t.key) ? <Badge tone="good">{tr("b.new.onBoard")}</Badge> : null}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button type="button" size="sm" variant="ghost" onClick={onBack}>{tr("b.new.back")}</Button>
      </div>
      <input
        type="search"
        aria-label={tr("b.new.searchTemplates")}
        placeholder={tr("b.new.searchTemplates")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="min-h-11 w-full rounded-full border border-line bg-card px-4"
      />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setCategory(null)}
          aria-pressed={category === null}
          className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold ${category === null ? "bg-ink text-paper" : "bg-card ring-1 ring-line"}`}
        >
          {tr("b.new.allCategories")}
        </button>
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold whitespace-nowrap ${category === c ? "bg-ink text-paper" : "bg-card ring-1 ring-line"}`}
          >
            {CATEGORY_LABELS[c]!.emoji} {CATEGORY_LABELS[c]![locale]}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="text-ink-soft">{tr("b.new.noMatch")}</p> : null}
      {routines.length ? (
        <section>
          <h3 className="mb-2 font-display text-lg font-bold text-plum">{tr("b.new.routines")}</h3>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">{routines.map(row)}</ul>
        </section>
      ) : null}
      {chores.length ? (
        <section>
          <h3 className="mb-2 font-display text-lg font-bold text-ink">{tr("b.new.chores")}</h3>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">{chores.map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
}
