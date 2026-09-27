"use client";

import { useState, useTransition } from "react";
import { saveChore, type ChoreFormInput } from "@/app/actions/chores";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Stepper } from "@/components/ui/Stepper";
import { amountInput, parseMoneyToCents } from "@/lib/money/format";
import { emojiColor } from "@/lib/emojiColors";
import { CATEGORIES, CATEGORY_LABELS, NAMED_INTERVALS, REPEAT_PRESETS } from "@/lib/templates";
import { useParentLocale, useParentT } from "@/lib/i18n/parent/client";
import { MAX_SECTION_LABEL, MAX_SUBTASKS, MAX_SUBTASK_TITLE, type Subtask } from "@/lib/schedule/checklist";

export interface EditableChore {
  id: string | null;
  title: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  price_cents: number;
  unit_label: string | null;
  max_quantity: number;
  repeat_kind: "once" | "daily" | "weekly" | "every_n_days";
  repeat_every_days: number | null;
  scope: "household" | "per_kid";
  category: string;
  requires_approval: boolean;
  note_for_kids: string | null;
  available_from: string | null;
  available_until: string | null;
  assignee_ids: string[];
  /** Checklist steps; empty for a plain chore. */
  subtasks: Subtask[];
  /** Set when a new chore starts from a template: its ready-made translations are reused if the text is unchanged. */
  template_key?: string | null;
}

/** One editor line: a step, or a section heading that groups the steps below it. */
type StepRow = { key: string; kind: "step" | "section"; text: string; id: string | null };

function toRows(subtasks: Subtask[]): StepRow[] {
  const rows: StepRow[] = [];
  let section: string | null = null;
  for (const s of subtasks) {
    const next = s.section ?? null;
    if (next && next !== section) rows.push({ key: `sec-${s.id}`, kind: "section", text: next, id: null });
    section = next;
    rows.push({ key: s.id, kind: "step", text: s.title, id: s.id });
  }
  return rows;
}

function toSubtasks(rows: StepRow[]): { id: string | null; title: string; section: string | null }[] {
  let section: string | null = null;
  const out: { id: string | null; title: string; section: string | null }[] = [];
  for (const r of rows) {
    if (r.kind === "section") section = r.text.trim() || null;
    else if (r.text.trim()) out.push({ id: r.id, title: r.text.trim(), section });
  }
  return out;
}

export const BLANK_CHORE: EditableChore = {
  id: null,
  title: "",
  description: "",
  emoji: "⭐",
  color: "#E08A1E",
  price_cents: 500,
  unit_label: null,
  max_quantity: 1,
  repeat_kind: "weekly",
  repeat_every_days: null,
  scope: "household",
  category: "other",
  requires_approval: true,
  note_for_kids: "",
  available_from: null,
  available_until: null,
  assignee_ids: [],
  subtasks: [],
};

const EMOJIS = ["⭐", "🧹", "🧽", "🧺", "🗑️", "🚗", "🍽️", "🛁", "🪴", "🍖", "🪑", "👟", "🧸", "🧥", "💡", "🐶", "📚", "🛏️", "🪟", "❄️", "🍂"];

export function ChoreEditor({
  initial,
  kids,
  onSaved,
}: {
  initial: EditableChore;
  kids: { id: string; name: string; color: string }[];
  onSaved: () => void;
}) {
  const t = useParentT();
  const locale = useParentLocale();
  const [c, setC] = useState(initial);
  const [price, setPrice] = useState(amountInput(initial.price_cents, locale, true));
  const [qty, setQty] = useState<number | null>(initial.max_quantity);
  const [days, setDays] = useState<number | null>(initial.repeat_every_days ?? 14);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<StepRow[]>(() => toRows(initial.subtasks ?? []));
  const [pending, start] = useTransition();
  const stepCount = rows.filter((r) => r.kind === "step").length;
  const isChecklist = rows.some((r) => r.kind === "step" && r.text.trim());
  const addRow = (kind: StepRow["kind"]) =>
    setRows((rs) => [...rs, { key: crypto.randomUUID(), kind, text: "", id: null }]);
  const moveRow = (i: number, delta: number) =>
    setRows((rs) => {
      const j = i + delta;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const set = <K extends keyof EditableChore>(k: K, v: EditableChore[K]) => setC((x) => ({ ...x, [k]: v }));
  const everyone = c.assignee_ids.length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseMoneyToCents(price);
    if (cents === null || cents < 0) return setError(t("b.editor.errPrice"));
    if (qty === null || qty < 1) return setError(t("b.editor.errQty"));
    if (c.repeat_kind === "every_n_days" && (days === null || days < 1)) return setError(t("b.editor.errDays"));
    const input: ChoreFormInput = {
      title: c.title,
      description: c.description || null,
      emoji: c.emoji || null,
      color: emojiColor(c.emoji) ?? c.color,
      price_cents: cents,
      unit_label: qty > 1 && !isChecklist ? c.unit_label || null : null,
      max_quantity: isChecklist ? 1 : qty,
      repeat_kind: c.repeat_kind,
      repeat_every_days: c.repeat_kind === "every_n_days" ? days : null,
      scope: isChecklist ? "per_kid" : c.scope,
      category: c.category as ChoreFormInput["category"],
      requires_approval: c.requires_approval,
      note_for_kids: c.note_for_kids || null,
      available_from: c.available_from || null,
      available_until: c.available_until || null,
      assignee_ids: c.assignee_ids,
      subtasks: toSubtasks(rows),
      ...(c.id ? {} : { template_key: c.template_key ?? null }),
    };
    start(async () => {
      const r = await saveChore(c.id, input);
      if (!r.ok) return setError(r.message);
      onSaved();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {isChecklist ? (
        <p className="rounded-xl border-l-[6px] border-plum bg-plum/10 px-4 py-3 font-bold text-plum">{t("b.editor.routineHeader")}</p>
      ) : null}
      <Field label={t("b.editor.title")}>
        <Input value={c.title} onChange={(e) => set("title", e.target.value)} maxLength={80} required autoFocus={!c.id} />
      </Field>
      <Field label={t("b.editor.description")}>
        <Textarea value={c.description ?? ""} onChange={(e) => set("description", e.target.value)} maxLength={400} rows={3} />
      </Field>

      <Field label={t("b.editor.category")} hint={t("b.editor.categoryHint")}>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set("category", k)}
              className={`min-h-11 rounded-full px-4 font-bold ${c.category === k ? "bg-amber text-white" : "bg-card ring-1 ring-line"}`}
            >
              {CATEGORY_LABELS[k]!.emoji} {CATEGORY_LABELS[k]![locale]}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t("b.editor.icon")} hint={t("b.editor.iconHint")}>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => set("emoji", em)}
              className={`h-11 w-11 rounded-xl text-2xl ring-inset ${c.emoji === em ? "ring-4" : "ring-1 ring-line"}`}
              style={{ background: `${emojiColor(em)}22`, ...(c.emoji === em ? { boxShadow: `inset 0 0 0 3px ${emojiColor(em)}` } : {}) }}
            >
              {em}
            </button>
          ))}
          <Input
            aria-label={t("b.editor.customEmoji")}
            value={c.emoji ?? ""}
            onChange={(e) => set("emoji", e.target.value.slice(0, 8))}
            className="w-20 text-center text-2xl"
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("b.editor.price")}>
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        {!isChecklist ? (
          <Field label={t("b.editor.maxQty")} hint={t("b.editor.maxQtyHint")}>
            <Stepper label={t("b.editor.maxQtyStepper")} value={qty} onChange={setQty} min={1} max={20} />
          </Field>
        ) : null}
      </div>
      {(qty ?? 1) > 1 && !isChecklist ? (
        <Field label={t("b.editor.unitLabel")} hint={t("b.editor.unitHint")}>
          <Input value={c.unit_label ?? ""} onChange={(e) => set("unit_label", e.target.value)} placeholder={t("b.editor.unitPlaceholder")} maxLength={30} />
        </Field>
      ) : null}

      {/* Not a <Field> (a <label>): its buttons would take the label as their name. */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-bold text-ink">{t("b.editor.subtasks")}</legend>
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={r.key} className="flex items-center gap-1.5">
              {r.kind === "section" ? (
                <Input
                  aria-label={t("b.editor.sectionN", { n: i + 1 })}
                  value={r.text}
                  onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, text: e.target.value } : x)))}
                  placeholder={t("b.editor.sectionPlaceholder")}
                  maxLength={MAX_SECTION_LABEL}
                  className="flex-1 font-extrabold"
                />
              ) : (
                <>
                  <span aria-hidden className="pl-1 text-lg text-ink-soft">☐</span>
                  <Input
                    aria-label={t("b.editor.stepN", { n: rows.slice(0, i + 1).filter((x) => x.kind === "step").length })}
                    value={r.text}
                    onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, text: e.target.value } : x)))}
                    placeholder={t("b.editor.stepPlaceholder")}
                    maxLength={MAX_SUBTASK_TITLE}
                    className="flex-1"
                  />
                </>
              )}
              <Button type="button" size="sm" variant="ghost" aria-label={t("b.editor.moveUp")} disabled={i === 0} onClick={() => moveRow(i, -1)}>↑</Button>
              <Button type="button" size="sm" variant="ghost" aria-label={t("b.editor.moveDown")} disabled={i === rows.length - 1} onClick={() => moveRow(i, 1)}>↓</Button>
              <Button type="button" size="sm" variant="ghost" aria-label={t("b.common.remove")} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>✕</Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={stepCount >= MAX_SUBTASKS} onClick={() => addRow("step")}>
              {t("b.editor.addStep")}
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={stepCount >= MAX_SUBTASKS} onClick={() => addRow("section")}>
              {t("b.editor.addSection")}
            </Button>
            {stepCount >= MAX_SUBTASKS ? <span className="self-center text-xs font-semibold text-ink-soft">{t("b.editor.maxSteps", { n: MAX_SUBTASKS })}</span> : null}
          </div>
          {isChecklist ? (
            <Alert tone="good">{t("b.editor.checklistNote")}</Alert>
          ) : null}
        </div>
        <span className="text-xs text-ink-soft">{t("b.editor.subtasksHint")}</span>
      </fieldset>

      <Field label={t("b.editor.repeat")}>
        <div className="flex flex-wrap gap-2">
          {(["once", "daily", "weekly", "every_n_days"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                set("repeat_kind", k);
              }}
              className={`min-h-11 rounded-full px-4 font-bold ${c.repeat_kind === k ? "bg-maple text-white" : "bg-card ring-1 ring-line"}`}
            >
              {{ once: t("b.editor.once"), daily: t("b.editor.daily"), weekly: t("b.editor.weekly"), every_n_days: t("b.editor.everyN") }[k]}
            </button>
          ))}
        </div>
        {c.repeat_kind === "every_n_days" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {REPEAT_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDays(n)}
                className={`min-h-10 rounded-full px-3 text-sm font-bold ${days === n ? "bg-amber text-white" : "bg-card ring-1 ring-line"}`}
              >
                {NAMED_INTERVALS[n]?.[locale] ?? t("b.editor.nDays", { n })}
              </button>
            ))}
            <Stepper label={t("b.editor.daysStepper")} value={days} onChange={setDays} min={1} max={365} />
          </div>
        ) : null}
      </Field>

      <Field label={t("b.editor.who")} hint={isChecklist ? t("b.editor.checklistScope") : undefined}>
        <Select value={isChecklist ? "per_kid" : c.scope} disabled={isChecklist} onChange={(e) => set("scope", e.target.value as EditableChore["scope"])}>
          <option value="household">{t("b.editor.scopeHousehold")}</option>
          <option value="per_kid">{t("b.editor.scopePerKid")}</option>
        </Select>
      </Field>

      <Field label={t("b.editor.assigned")}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set("assignee_ids", [])}
            className={`min-h-11 rounded-full px-4 font-bold ${everyone ? "bg-moss text-white" : "bg-card ring-1 ring-line"}`}
          >
            {t("b.editor.allKids")}
          </button>
          {kids.map((k) => {
            const on = c.assignee_ids.includes(k.id);
            return (
              <button
                key={k.id}
                type="button"
                onClick={() =>
                  set("assignee_ids", on ? c.assignee_ids.filter((id) => id !== k.id) : [...c.assignee_ids, k.id])
                }
                className={`min-h-11 rounded-full px-4 font-bold ${on ? "text-white" : "bg-card ring-1 ring-line"}`}
                style={on ? { background: k.color } : undefined}
              >
                {k.name}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("b.editor.from")} hint={t("b.editor.fromHint")}>
          <Input type="date" value={c.available_from ?? ""} onChange={(e) => set("available_from", e.target.value || null)} />
        </Field>
        <Field label={t("b.editor.until")}>
          <Input type="date" value={c.available_until ?? ""} onChange={(e) => set("available_until", e.target.value || null)} />
        </Field>
      </div>

      <Field label={t("b.editor.note")} hint={t("b.editor.noteHint")}>
        <Input value={c.note_for_kids ?? ""} onChange={(e) => set("note_for_kids", e.target.value)} maxLength={200} />
      </Field>

      <label className="flex items-center gap-3 font-bold text-ink">
        <input
          type="checkbox"
          checked={c.requires_approval}
          onChange={(e) => set("requires_approval", e.target.checked)}
          className="h-5 w-5 accent-maple"
        />
        {t("b.editor.needsCheck")}
      </label>

      {error ? <Alert tone="bad">{error}</Alert> : null}
      <div className="sticky bottom-0 -mx-5 border-t border-line bg-paper px-5 py-3">
        <Button type="submit" size="lg" className="w-full" disabled={pending || qty === null || (c.repeat_kind === "every_n_days" && days === null)}>
          {pending ? t("b.editor.saving") : c.id ? t("b.editor.save") : t("b.editor.add")}
        </Button>
      </div>
    </form>
  );
}
