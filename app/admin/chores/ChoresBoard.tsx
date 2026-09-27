"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addChoresFromTemplates,
  deleteChore,
  duplicateChore,
  makeChoreAvailable,
  reorderChores,
  retranslateChores,
  setChoreActive,
  updateChorePrice,
} from "@/app/actions/chores";
import { ChoreCard } from "@/components/kid/ChoreCard";
import { BLANK_CHORE, ChoreEditor, type EditableChore } from "@/components/admin/ChoreEditor";
import { PriceInput, TemplatePicker, repeatLabel } from "@/components/admin/TemplatePicker";
import { TemplateChooser, templateToEditable } from "@/components/admin/TemplateChooser";
import { Alert, Badge, Button, EmptyState, PageHeader } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { formatPrice } from "@/lib/money/format";
import type { ParentChoreStatus } from "@/lib/board/parentStatus";
import type { ChoreTemplate } from "@/lib/templates";
import { intlLocale, type Locale } from "@/lib/i18n";
import { useParentT } from "@/lib/i18n/parent/client";

export interface AdminChore extends Omit<EditableChore, "id"> {
  id: string;
  displayColor: string;
  active: boolean;
  template_key: string | null;
  hasHistory: boolean;
  status: ParentChoreStatus;
}

type Filter = "active" | "paused" | "seasonal" | "routines" | "all";

export function ChoresBoard({
  chores,
  kids,
  templates,
  currency,
  locale,
  readOnly,
  showTranslate = false,
}: {
  chores: AdminChore[];
  kids: { id: string; name: string; color: string }[];
  templates: ChoreTemplate[];
  currency: string;
  locale: Locale;
  readOnly: boolean;
  /** Only when a kid reads a language other than the home's. */
  showTranslate?: boolean;
}) {
  const router = useRouter();
  const t = useParentT();
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EditableChore | null>(null);
  const [picking, setPicking] = useState(false);
  const [choosing, setChoosing] = useState<"menu" | "templates" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const translate = (id?: string) =>
    start(async () => {
      setError(null);
      setNotice(id ? t("b.chores.translating") : t("b.chores.translatingAll"));
      const r = await retranslateChores(id);
      if (!r.ok) {
        setNotice(null);
        return setError(r.message);
      }
      setNotice(t("b.chores.translated", { done: r.data?.translated ?? 0, total: r.data?.total ?? 0 }));
      router.refresh();
    });

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
    if (filter === "routines") return c.subtasks.length > 0;
    return true;
  });

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? t("b.common.somethingWrong"));
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
        title={t("b.chores.title")}
        subtitle={t("b.chores.subtitle")}
        actions={
          readOnly ? null : (
            <>
              {showTranslate ? <Button variant="secondary" disabled={pending} onClick={() => translate()}>{t("b.chores.translateAll")}</Button> : null}
              <Button variant="secondary" onClick={() => setPicking(true)}>{t("b.chores.addFromTemplates")}</Button>
              <Button onClick={() => setChoosing("menu")}>{t("b.chores.newChore")}</Button>
            </>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["active", "paused", "seasonal", "routines", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-10 rounded-full px-4 text-sm font-bold capitalize ${filter === f ? "bg-ink text-paper" : "bg-card ring-1 ring-line"}`}
          >
            {t(`b.chores.filter.${f}`)}
          </button>
        ))}
        <input
          type="search"
          placeholder={t("b.chores.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ml-auto min-h-10 w-full rounded-full border border-line bg-card px-4 text-sm sm:w-56"
        />
      </div>

      {error ? <div className="mb-4"><Alert tone="bad">{error}</Alert></div> : null}
      {notice ? <div className="mb-4"><Alert tone="good">{notice}</Alert></div> : null}

      {visible.length === 0 && filter === "active" && !query ? (
        <EmptyState emoji="🧹" title={t("b.chores.emptyTitle")}>{t("b.chores.emptyBody")}</EmptyState>
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
            <div
              className={`${c.active ? "" : "opacity-50 grayscale"} ${
                c.subtasks.length ? "rounded-[var(--radius-card)] border-t-[6px] border-plum ring-2 ring-plum/30" : ""
              }`}
            >
              <ChoreCardAdmin chore={c} currency={currency} locale={locale} readOnly={readOnly} onPrice={(cents) => run(() => updateChorePrice(c.id, cents))} />
            </div>
            <div><StatusLine status={c.status} locale={locale} /></div>
            <p className="text-xs font-semibold text-ink-soft">
              {repeatLabel(c.repeat_kind, c.repeat_every_days, locale)} · {c.scope === "household" ? t("b.chores.wholeHouse") : t("b.chores.eachKid")}
              {c.assignee_ids.length ? ` · ${c.assignee_ids.map((id) => kids.find((k) => k.id === id)?.name).filter(Boolean).join(", ")}` : ""}
            </p>
            {!readOnly ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setEditing({ ...c })}>{t("b.chores.edit")}</Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setChoreActive(c.id, !c.active))}>
                  {c.active ? t("b.chores.pause") : t("b.chores.resume")}
                </Button>
                {/* Resting or done: one tap puts it back on the kids' boards. */}
                {c.status.kind === "cooldown" || c.status.kind === "done" ? (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => makeChoreAvailable(c.id))}>
                    ↺ {t("b.chores.makeAvailable")}
                  </Button>
                ) : null}
                {showTranslate ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => translate(c.id)}>{t("b.chores.translate")}</Button> : null}
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => duplicateChore(c.id))}>{t("b.chores.duplicate")}</Button>
                <DeleteButton chore={c} onDelete={() => run(() => deleteChore(c.id))} onPause={() => run(() => setChoreActive(c.id, false))} />
                <span className="ml-auto flex">
                  <Button size="sm" variant="ghost" aria-label={t("b.chores.moveEarlier")} disabled={idx === 0} onClick={() => move(c.id, -1)}>↑</Button>
                  <Button size="sm" variant="ghost" aria-label={t("b.chores.moveLater")} disabled={idx === visible.length - 1} onClick={() => move(c.id, 1)}>↓</Button>
                </span>
              </div>
            ) : null}
          </div>
        ))}

        {!readOnly && filter !== "paused" ? (
          <button
            type="button"
            onClick={() => setChoosing("menu")}
            className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line text-ink-soft hover:border-amber hover:text-amber"
          >
            <span className="text-5xl">+</span>
            <span className="font-bold">{t("b.chores.addChore")}</span>
          </button>
        ) : null}
      </div>

      <Sheet open={Boolean(editing)} title={editing?.id ? t("b.chores.editChore") : t("b.chores.newChoreTitle")} onClose={() => setEditing(null)}>
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

      <Sheet
        open={choosing !== null}
        title={choosing === "templates" ? t("b.new.pickTemplate") : t("b.chores.newChoreTitle")}
        onClose={() => setChoosing(null)}
        wide={choosing === "templates"}
      >
        {choosing === "menu" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setChoosing("templates")}
              className="flex min-h-24 flex-col items-start justify-center gap-1 rounded-2xl bg-card p-5 text-left ring-2 ring-line hover:ring-amber"
            >
              <span className="font-display text-xl font-bold text-ink">{t("b.new.fromTemplate")}</span>
              <span className="text-sm text-ink-soft">{t("b.new.fromTemplateHint")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setChoosing(null);
                setEditing(BLANK_CHORE);
              }}
              className="flex min-h-24 flex-col items-start justify-center gap-1 rounded-2xl bg-card p-5 text-left ring-2 ring-line hover:ring-amber"
            >
              <span className="font-display text-xl font-bold text-ink">{t("b.new.blank")}</span>
              <span className="text-sm text-ink-soft">{t("b.new.blankHint")}</span>
            </button>
          </div>
        ) : choosing === "templates" ? (
          <TemplateChooser
            templates={templates}
            onBoardKeys={existingKeys}
            currency={currency}
            locale={locale}
            onBack={() => setChoosing("menu")}
            onPick={(tpl) => {
              setChoosing(null);
              setEditing(templateToEditable(tpl, new Date()));
            }}
          />
        ) : null}
      </Sheet>

      <Sheet open={picking} title={t("b.chores.templatesTitle")} onClose={() => setPicking(false)} wide>
        {existingKeys.length >= templates.length ? (
          <EmptyState emoji="✅" title={t("b.chores.haveAllTemplates")} />
        ) : (
          <TemplatePicker
            templates={templates}
            excludeKeys={existingKeys}
            currency={currency}
            locale={locale}
            busy={pending}
            submitLabel={t("b.chores.addSelected")}
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
  locale: Locale;
  readOnly: boolean;
  onPrice: (cents: number) => void;
}) {
  const t = useParentT();
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
      footer={
        chore.subtasks.length ? (
          <span className="rounded-full bg-plum/15 px-2.5 py-0.5 text-sm font-bold text-plum" title={chore.subtasks.map((s) => s.title).join(" · ")}>
            🔁 {t("b.routine.label")} · {t(chore.subtasks.length === 1 ? "b.chores.stepOne" : "b.chores.stepMany", { n: chore.subtasks.length })}
          </span>
        ) : undefined
      }
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
            <button type="submit" className="h-9 w-9 rounded-full bg-moss font-black text-white" aria-label={t("b.chores.savePrice")}>✓</button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditingPrice(true)}
            title={t("b.chores.tapPrice")}
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

function StatusLine({ status, locale }: { status: ParentChoreStatus; locale: Locale }) {
  const t = useParentT();
  const date = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric" });
  switch (status.kind) {
    case "paused":
      return <Badge>{t("b.chores.status.paused")}</Badge>;
    case "available":
      return <Badge tone="good">{t("b.chores.status.available")}</Badge>;
    case "waiting":
      return (
        <Badge tone="warn">
          {status.count > 1 ? t("b.chores.status.waitingCount", { count: status.count }) : t("b.chores.status.waiting")}
        </Badge>
      );
    case "done":
      return <Badge>{t("b.chores.status.done")}</Badge>;
    case "out_of_season":
      return (
        <Badge>
          {status.startsAt ? t("b.chores.status.outOfSeasonStarts", { date: date(status.startsAt) }) : t("b.chores.status.outOfSeason")}
        </Badge>
      );
    case "cooldown":
      return (
        <Badge tone="bad">
          {status.days === 1 ? t("b.chores.status.backInOne") : t("b.chores.status.backIn", { days: status.days })}
          {status.lastKidName ? t("b.chores.status.lastDoneBy", { name: status.lastKidName, date: date(status.lastDate) }) : ""}
        </Badge>
      );
  }
}

function DeleteButton({ chore, onDelete, onPause }: { chore: AdminChore; onDelete: () => void; onPause: () => void }) {
  const t = useParentT();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
        {t("b.chores.delete")}
      </Button>
    );
  }
  if (chore.hasHistory) {
    return (
      <span className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-gold/30 p-2 text-xs font-semibold text-ink">
        {t("b.chores.hasHistory")}
        {chore.active ? <Button size="sm" variant="secondary" onClick={() => { setAsking(false); onPause(); }}>{t("b.chores.pauseInstead")}</Button> : null}
        <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>{t("b.common.ok")}</Button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button size="sm" variant="danger" onClick={onDelete}>{t("b.chores.yesDelete")}</Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>{t("b.common.cancel")}</Button>
    </span>
  );
}
