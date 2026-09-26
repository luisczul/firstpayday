"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addChoresFromTemplates,
  deleteChore,
  duplicateChore,
  reorderChores,
  setChoreActive,
  updateChorePrice,
} from "@/app/actions/chores";
import { ChoreCard } from "@/components/kid/ChoreCard";
import { BLANK_CHORE, ChoreEditor, type EditableChore } from "@/components/admin/ChoreEditor";
import { PriceInput, TemplatePicker, repeatLabel } from "@/components/admin/TemplatePicker";
import { Alert, Badge, Button, EmptyState, PageHeader } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { formatPrice } from "@/lib/money/format";
import type { ParentChoreStatus } from "@/lib/board/parentStatus";
import type { ChoreTemplate } from "@/lib/templates";

export interface AdminChore extends Omit<EditableChore, "id"> {
  id: string;
  displayColor: string;
  active: boolean;
  template_key: string | null;
  hasHistory: boolean;
  status: ParentChoreStatus;
}

type Filter = "active" | "paused" | "seasonal" | "all";

export function ChoresBoard({
  chores,
  kids,
  templates,
  currency,
  locale,
  readOnly,
}: {
  chores: AdminChore[];
  kids: { id: string; name: string; color: string }[];
  templates: ChoreTemplate[];
  currency: string;
  locale: "en" | "fr";
  readOnly: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EditableChore | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ordered = useMemo(() => {
    if (!order) return chores;
    const byId = new Map(chores.map((c) => [c.id, c]));
    return order.map((id) => byId.get(id)).filter((c): c is AdminChore => Boolean(c));
  }, [chores, order]);

  const visible = ordered.filter((c) => {
    if (query && !c.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "active") return c.active;
    if (filter === "paused") return !c.active;
    if (filter === "seasonal") return Boolean(c.available_from || c.available_until);
    return true;
  });

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Something went wrong.");
      router.refresh();
    });

  const move = (id: string, delta: number) => {
    const ids = ordered.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    setOrder(ids);
    run(() => reorderChores(ids));
  };

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = ordered.map((c) => c.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setOrder(ids);
    setDragId(null);
    run(() => reorderChores(ids));
  };

  const existingKeys = chores.map((c) => c.template_key).filter((k): k is string => Boolean(k));

  return (
    <>
      <PageHeader
        title="Chores"
        subtitle="These are the exact cards your kids see."
        actions={
          readOnly ? null : (
            <>
              <Button variant="secondary" onClick={() => setPicking(true)}>📋 Add from templates</Button>
              <Button onClick={() => setEditing(BLANK_CHORE)}>+ New chore</Button>
            </>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["active", "paused", "seasonal", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-10 rounded-full px-4 text-sm font-bold capitalize ${filter === f ? "bg-ink text-paper" : "bg-card ring-1 ring-line"}`}
          >
            {f}
          </button>
        ))}
        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ml-auto min-h-10 w-full rounded-full border border-line bg-card px-4 text-sm sm:w-56"
        />
      </div>

      {error ? <div className="mb-4"><Alert tone="bad">{error}</Alert></div> : null}

      {visible.length === 0 && filter === "active" && !query ? (
        <EmptyState emoji="🧹" title="No active chores yet">Add some from the templates to get started.</EmptyState>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((c, idx) => (
          <div
            key={c.id}
            draggable={!readOnly}
            onDragStart={() => setDragId(c.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOn(c.id)}
            className={`flex flex-col gap-2 ${dragId === c.id ? "opacity-40" : ""}`}
          >
            <div className={c.active ? "" : "opacity-50 grayscale"}>
              <ChoreCardAdmin chore={c} currency={currency} locale={locale} readOnly={readOnly} onPrice={(cents) => run(() => updateChorePrice(c.id, cents))} />
            </div>
            <div><StatusLine status={c.status} locale={locale} /></div>
            <p className="text-xs font-semibold text-ink-soft">
              {repeatLabel(c.repeat_kind, c.repeat_every_days, locale)} · {c.scope === "household" ? "Whole house" : "Each kid"}
              {c.assignee_ids.length ? ` · ${c.assignee_ids.map((id) => kids.find((k) => k.id === id)?.name).filter(Boolean).join(", ")}` : ""}
            </p>
            {!readOnly ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setEditing({ ...c })}>Edit</Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setChoreActive(c.id, !c.active))}>
                  {c.active ? "⏸ Pause" : "▶ Resume"}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => duplicateChore(c.id))}>Duplicate</Button>
                <DeleteButton chore={c} onDelete={() => run(() => deleteChore(c.id))} onPause={() => run(() => setChoreActive(c.id, false))} />
                <span className="ml-auto flex">
                  <Button size="sm" variant="ghost" aria-label="Move earlier" disabled={idx === 0} onClick={() => move(c.id, -1)}>↑</Button>
                  <Button size="sm" variant="ghost" aria-label="Move later" disabled={idx === visible.length - 1} onClick={() => move(c.id, 1)}>↓</Button>
                </span>
              </div>
            ) : null}
          </div>
        ))}

        {!readOnly && filter !== "paused" ? (
          <button
            type="button"
            onClick={() => setEditing(BLANK_CHORE)}
            className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line text-ink-soft hover:border-amber hover:text-amber"
          >
            <span className="text-5xl">+</span>
            <span className="font-bold">Add chore</span>
          </button>
        ) : null}
      </div>

      <Sheet open={Boolean(editing)} title={editing?.id ? "Edit chore" : "New chore"} onClose={() => setEditing(null)}>
        {editing ? (
          <ChoreEditor
            key={editing.id ?? "new"}
            initial={editing}
            kids={kids}
            onSaved={() => {
              setEditing(null);
              setOrder(null);
              router.refresh();
            }}
          />
        ) : null}
      </Sheet>

      <Sheet open={picking} title="Add from templates" onClose={() => setPicking(false)} wide>
        {existingKeys.length >= templates.length ? (
          <EmptyState emoji="✅" title="You already have every template." />
        ) : (
          <TemplatePicker
            templates={templates}
            excludeKeys={existingKeys}
            currency={currency}
            locale={locale}
            busy={pending}
            submitLabel="Add selected"
            onSubmit={(picks) =>
              start(async () => {
                const r = await addChoresFromTemplates(picks);
                if (!r.ok) return setError(r.message);
                setPicking(false);
                router.refresh();
              })
            }
          />
        )}
      </Sheet>
    </>
  );
}

function ChoreCardAdmin({
  chore,
  currency,
  locale,
  readOnly,
  onPrice,
}: {
  chore: AdminChore;
  currency: string;
  locale: "en" | "fr";
  readOnly: boolean;
  onPrice: (cents: number) => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [draft, setDraft] = useState(chore.price_cents);
  return (
    <ChoreCard
      chore={{
        title: chore.title,
        description: chore.description,
        emoji: chore.emoji,
        color: chore.displayColor,
        priceCents: chore.price_cents,
        unitLabel: chore.unit_label,
      }}
      variant="admin"
      currency={currency}
      locale={locale}
      perLabel={chore.unit_label ? `/ ${chore.unit_label}` : undefined}
      size="md"
      priceSlot={
        readOnly ? undefined : editingPrice ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              setEditingPrice(false);
              if (draft !== chore.price_cents) onPrice(draft);
            }}
          >
            <PriceInput cents={chore.price_cents} currency={currency} locale={locale} onChange={setDraft} autoFocus />
            <button type="submit" className="h-9 w-9 rounded-full bg-moss font-black text-white" aria-label="Save price">✓</button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditingPrice(true)}
            title="Tap to change the price"
            className="inline-flex items-center rounded-full bg-gold px-3.5 py-1.5 text-lg font-black text-ink shadow-[0_2px_0_rgb(59_36_24/0.15)] hover:ring-2 hover:ring-amber"
          >
            {formatPrice(chore.price_cents, currency, locale)}
            {chore.unit_label ? <span className="ml-1 text-sm font-bold text-ink-soft">/ {chore.unit_label}</span> : null}
            <span className="ml-1 text-xs" aria-hidden>✏️</span>
          </button>
        )
      }
    />
  );
}

function StatusLine({ status, locale }: { status: ParentChoreStatus; locale: "en" | "fr" }) {
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric" });
  switch (status.kind) {
    case "paused":
      return <Badge>⏸ Paused</Badge>;
    case "available":
      return <Badge tone="good">● Available</Badge>;
    case "waiting":
      return <Badge tone="warn">⏳ Waiting for your check{status.count > 1 ? ` (${status.count})` : ""}</Badge>;
    case "done":
      return <Badge>✓ Done for good</Badge>;
    case "out_of_season":
      return <Badge>🍂 Out of season{status.startsAt ? `, starts ${date(status.startsAt)}` : ""}</Badge>;
    case "cooldown":
      return (
        <Badge tone="bad">
          🌙 Back in {status.days} day{status.days === 1 ? "" : "s"}
          {status.lastKidName ? ` (last done by ${status.lastKidName} on ${date(status.lastDate)})` : ""}
        </Badge>
      );
  }
}

function DeleteButton({ chore, onDelete, onPause }: { chore: AdminChore; onDelete: () => void; onPause: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
        Delete
      </Button>
    );
  }
  if (chore.hasHistory) {
    return (
      <span className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-gold/30 p-2 text-xs font-semibold text-ink">
        This chore has history, so it stays for your records. Pause it to hide it from kids.
        {chore.active ? <Button size="sm" variant="secondary" onClick={() => { setAsking(false); onPause(); }}>Pause instead</Button> : null}
        <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>OK</Button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button size="sm" variant="danger" onClick={onDelete}>Yes, delete</Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
    </span>
  );
}
