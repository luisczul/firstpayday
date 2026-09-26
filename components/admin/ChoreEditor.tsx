"use client";

import { useState, useTransition } from "react";
import { saveChore, type ChoreFormInput } from "@/app/actions/chores";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { parseMoneyToCents } from "@/lib/money/format";
import { REPEAT_PRESETS } from "@/lib/templates";

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
  requires_approval: boolean;
  note_for_kids: string | null;
  available_from: string | null;
  available_until: string | null;
  assignee_ids: string[];
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
  requires_approval: true,
  note_for_kids: "",
  available_from: null,
  available_until: null,
  assignee_ids: [],
};

const COLORS = ["#B8431F", "#E08A1E", "#F2C14E", "#6B7A2E", "#7A3B4A", "#2F6F8F", "#8A5A9E", "#3C8D6E"];
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
  const [c, setC] = useState(initial);
  const [price, setPrice] = useState((initial.price_cents / 100).toFixed(2).replace(/\.00$/, ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof EditableChore>(k: K, v: EditableChore[K]) => setC((x) => ({ ...x, [k]: v }));
  const everyone = c.assignee_ids.length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseMoneyToCents(price);
    if (cents === null || cents < 0) return setError("Enter a valid price.");
    const input: ChoreFormInput = {
      title: c.title,
      description: c.description || null,
      emoji: c.emoji || null,
      color: c.color,
      price_cents: cents,
      unit_label: c.max_quantity > 1 ? c.unit_label || null : null,
      max_quantity: c.max_quantity,
      repeat_kind: c.repeat_kind,
      repeat_every_days: c.repeat_kind === "every_n_days" ? (c.repeat_every_days ?? 7) : null,
      scope: c.scope,
      requires_approval: c.requires_approval,
      note_for_kids: c.note_for_kids || null,
      available_from: c.available_from || null,
      available_until: c.available_until || null,
      assignee_ids: c.assignee_ids,
    };
    start(async () => {
      const r = await saveChore(c.id, input);
      if (!r.ok) return setError(r.message);
      onSaved();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label="Title">
        <Input value={c.title} onChange={(e) => set("title", e.target.value)} maxLength={80} required autoFocus={!c.id} />
      </Field>
      <Field label="Description (what kids read)">
        <Textarea value={c.description ?? ""} onChange={(e) => set("description", e.target.value)} maxLength={400} rows={3} />
      </Field>

      <Field label="Emoji">
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => set("emoji", em)}
              className={`h-11 w-11 rounded-xl text-2xl ${c.emoji === em ? "bg-gold ring-2 ring-amber" : "bg-card ring-1 ring-line"}`}
            >
              {em}
            </button>
          ))}
          <Input
            aria-label="Custom emoji"
            value={c.emoji ?? ""}
            onChange={(e) => set("emoji", e.target.value.slice(0, 8))}
            className="w-20 text-center text-2xl"
          />
        </div>
      </Field>

      <Field label="Stripe color">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((col) => (
            <button
              key={col}
              type="button"
              aria-label={col}
              onClick={() => set("color", col)}
              className={`h-10 w-10 rounded-full ${c.color === col ? "ring-4 ring-ink/30" : ""}`}
              style={{ background: col }}
            />
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price">
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Max quantity" hint="e.g. 3 floors">
          <Input
            type="number"
            min={1}
            max={20}
            value={c.max_quantity}
            onChange={(e) => set("max_quantity", Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          />
        </Field>
      </div>
      {c.max_quantity > 1 ? (
        <Field label="Unit label" hint="Shown as “$5 / floor”">
          <Input value={c.unit_label ?? ""} onChange={(e) => set("unit_label", e.target.value)} placeholder="floor" maxLength={30} />
        </Field>
      ) : null}

      <Field label="Repeat">
        <div className="flex flex-wrap gap-2">
          {(["once", "daily", "weekly", "every_n_days"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                set("repeat_kind", k);
                if (k === "every_n_days" && !c.repeat_every_days) set("repeat_every_days", 14);
              }}
              className={`min-h-11 rounded-full px-4 font-bold ${c.repeat_kind === k ? "bg-maple text-white" : "bg-card ring-1 ring-line"}`}
            >
              {{ once: "Once", daily: "Daily", weekly: "Weekly", every_n_days: "Every N days" }[k]}
            </button>
          ))}
        </div>
        {c.repeat_kind === "every_n_days" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {REPEAT_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set("repeat_every_days", n)}
                className={`min-h-10 rounded-full px-3 text-sm font-bold ${c.repeat_every_days === n ? "bg-amber text-white" : "bg-card ring-1 ring-line"}`}
              >
                {n} days
              </button>
            ))}
            <Input
              type="number"
              min={1}
              max={365}
              aria-label="Days"
              value={c.repeat_every_days ?? 14}
              onChange={(e) => set("repeat_every_days", Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
              className="w-24"
            />
          </div>
        ) : null}
      </Field>

      <Field label="Who can do it at a time?">
        <Select value={c.scope} onChange={(e) => set("scope", e.target.value as EditableChore["scope"])}>
          <option value="household">Whole house: first kid to do it takes it</option>
          <option value="per_kid">Each kid separately</option>
        </Select>
      </Field>

      <Field label="Assigned kids">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set("assignee_ids", [])}
            className={`min-h-11 rounded-full px-4 font-bold ${everyone ? "bg-moss text-white" : "bg-card ring-1 ring-line"}`}
          >
            All kids
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
        <Field label="Available from" hint="Seasonal (optional)">
          <Input type="date" value={c.available_from ?? ""} onChange={(e) => set("available_from", e.target.value || null)} />
        </Field>
        <Field label="Available until">
          <Input type="date" value={c.available_until ?? ""} onChange={(e) => set("available_until", e.target.value || null)} />
        </Field>
      </div>

      <Field label="Note for kids" hint="Shown on the confirm screen, e.g. “Ask Dad for the ladder”">
        <Input value={c.note_for_kids ?? ""} onChange={(e) => set("note_for_kids", e.target.value)} maxLength={200} />
      </Field>

      <label className="flex items-center gap-3 font-bold text-ink">
        <input
          type="checkbox"
          checked={c.requires_approval}
          onChange={(e) => set("requires_approval", e.target.checked)}
          className="h-5 w-5 accent-maple"
        />
        Needs a parent&apos;s check before paying
      </label>

      {error ? <Alert tone="bad">{error}</Alert> : null}
      <div className="sticky bottom-0 -mx-5 border-t border-line bg-paper px-5 py-3">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : c.id ? "Save chore" : "Add chore"}
        </Button>
      </div>
    </form>
  );
}
