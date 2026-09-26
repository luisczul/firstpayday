"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { approveAllForKid, approveSubmission, rejectSubmission, sendBackSubmission } from "@/app/actions/approvals";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { Alert, Button, EmptyState, Input } from "@/components/ui";
import { formatMoney } from "@/lib/money/format";
import { matchFor } from "@/lib/money/ledger";

export interface QueueItem {
  id: string;
  kidId: string;
  kidName: string;
  kidColor: string;
  kidAvatar: string | null;
  title: string;
  emoji: string | null;
  quantity: number;
  maxQuantity: number;
  unitLabel: string | null;
  unitPriceCents: number;
  submittedAt: string;
  resubmitted: boolean;
  previousComment: string | null;
}

const QUICK = ["Missed a spot", "Not finished", "Please redo carefully"];
const QUICK_FR = ["Un endroit oublié", "Pas terminé", "Refais-le avec soin"];

export function ApprovalQueue({
  items,
  currency,
  locale,
  readOnly,
  matchPercent,
}: {
  items: QueueItem[];
  currency: string;
  locale: "en" | "fr";
  readOnly: boolean;
  matchPercent: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const visible = items.filter((i) => !hidden.has(i.id));
  const byKid = useMemo(() => {
    const m = new Map<string, QueueItem[]>();
    for (const i of visible) m.set(i.kidId, [...(m.get(i.kidId) ?? []), i]);
    return [...m.values()];
  }, [visible]);

  const hide = (id: string) => setHidden((s) => new Set(s).add(id));
  const unhide = (id: string) =>
    setHidden((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });

  if (visible.length === 0) {
    return (
      <EmptyState emoji="🎉" title="All caught up!">
        When your kids tap “I did it!”, their chores show up here right away.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {byKid.map((group) => (
        <KidGroup
          key={group[0]!.kidId}
          items={group}
          currency={currency}
          locale={locale}
          readOnly={readOnly}
          matchPercent={matchPercent}
          onHide={hide}
          onUnhide={unhide}
          onError={setError}
        />
      ))}
    </div>
  );
}

function KidGroup({
  items,
  currency,
  locale,
  readOnly,
  matchPercent,
  onHide,
  onUnhide,
  onError,
}: {
  items: QueueItem[];
  currency: string;
  locale: "en" | "fr";
  readOnly: boolean;
  matchPercent: number;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onError: (m: string | null) => void;
}) {
  const kid = items[0]!;
  const [confirmAll, setConfirmAll] = useState(false);
  const [pending, start] = useTransition();
  const total = items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <KidAvatar name={kid.kidName} color={kid.kidColor} avatarUrl={kid.kidAvatar} size={44} ring={false} />
        <h2 className="font-display text-2xl font-bold text-ink">{kid.kidName}</h2>
        {items.length > 1 && !readOnly ? (
          confirmAll ? (
            <span className="ml-auto flex items-center gap-2 rounded-xl bg-moss/10 px-3 py-1.5">
              <span className="text-sm font-bold text-moss">
                Approve {items.length} for {formatMoney(total, currency, locale)}?
              </span>
              <Button
                variant="success"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    items.forEach((i) => onHide(i.id));
                    const r = await approveAllForKid(kid.kidId);
                    if (!r.ok) {
                      items.forEach((i) => onUnhide(i.id));
                      onError(r.message);
                    }
                    setConfirmAll(false);
                  })
                }
              >
                Yes, approve all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmAll(false)}>Cancel</Button>
            </span>
          ) : (
            <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setConfirmAll(true)}>
              Approve all ({items.length})
            </Button>
          )
        ) : null}
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((i) => (
          <ApprovalItem
            key={i.id}
            item={i}
            currency={currency}
            locale={locale}
            readOnly={readOnly}
            matchPercent={matchPercent}
            onHide={onHide}
            onUnhide={onUnhide}
            onError={onError}
          />
        ))}
      </ul>
    </section>
  );
}

function ApprovalItem({
  item,
  currency,
  locale,
  readOnly,
  matchPercent,
  onHide,
  onUnhide,
  onError,
}: {
  item: QueueItem;
  currency: string;
  locale: "en" | "fr";
  readOnly: boolean;
  matchPercent: number;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onError: (m: string | null) => void;
}) {
  const [qty, setQty] = useState(item.quantity);
  const [mode, setMode] = useState<"idle" | "sendBack" | "reject">("idle");
  const [comment, setComment] = useState("");
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();
  const money = (c: number) => formatMoney(c, currency, locale);
  const amount = qty * item.unitPriceCents;
  const match = matchFor(amount, matchPercent);

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      onError(null);
      onHide(item.id);
      const r = await fn();
      if (!r.ok) {
        onUnhide(item.id);
        onError(r.message ?? "Something went wrong.");
      }
    });

  return (
    <li className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-4xl" aria-hidden>{item.emoji ?? "⭐"}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold leading-tight text-ink">
            {item.title}
            {item.resubmitted ? <span className="ml-2 rounded-full bg-plum/10 px-2 py-0.5 align-middle font-sans text-xs font-black text-plum">FIXED</span> : null}
          </p>
          <p className="text-sm text-ink-soft">
            {formatDistanceToNow(new Date(item.submittedAt), { addSuffix: true, locale: locale === "fr" ? frLocale : undefined })}
            {item.previousComment ? ` · you said “${item.previousComment}”` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {item.maxQuantity > 1 ? (
            <span className="flex items-center gap-1 rounded-xl bg-paper px-1 py-1">
              <button type="button" className="h-9 w-9 rounded-lg text-xl font-black disabled:opacity-30" disabled={qty <= 1 || readOnly} onClick={() => setQty(qty - 1)} aria-label="Less">−</button>
              <span className="w-6 text-center font-black">{qty}</span>
              <button type="button" className="h-9 w-9 rounded-lg text-xl font-black disabled:opacity-30" disabled={qty >= item.maxQuantity || readOnly} onClick={() => setQty(qty + 1)} aria-label="More">+</button>
            </span>
          ) : null}
          <span className="text-right">
            <span className="block text-xs font-bold text-ink-soft">
              {qty} × {money(item.unitPriceCents)}
              {item.unitLabel ? ` / ${item.unitLabel}` : ""}
            </span>
            <span className="block font-display text-2xl font-bold text-moss">{money(amount)}</span>
            {match > 0 ? <span className="block text-xs font-bold text-amber">+ {money(match)} match</span> : null}
          </span>
        </div>
      </div>

      {!readOnly && mode === "idle" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="success"
            size="lg"
            className="min-w-36 flex-1 sm:flex-none"
            disabled={pending}
            onClick={() => act(() => approveSubmission(item.id, qty))}
          >
            ✓ Approve
          </Button>
          <Button variant="secondary" size="lg" disabled={pending} onClick={() => setMode("sendBack")}>
            ↩ Send back
          </Button>
          <div className="relative ml-auto">
            <Button variant="ghost" size="lg" aria-label="More" onClick={() => setMenu((m) => !m)}>⋯</Button>
            {menu ? (
              <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl bg-card p-1 shadow-[var(--shadow-pop)] ring-1 ring-line">
                <button
                  type="button"
                  className="min-h-11 w-full rounded-lg px-3 text-left font-bold text-danger hover:bg-paper"
                  onClick={() => {
                    setMenu(false);
                    setMode("reject");
                  }}
                >
                  Reject…
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode !== "idle" ? (
        <form
          className="mt-4 flex flex-col gap-3 rounded-xl bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!comment.trim()) return;
            act(() => (mode === "sendBack" ? sendBackSubmission(item.id, comment) : rejectSubmission(item.id, comment)));
          }}
        >
          <p className="text-sm font-bold text-ink">
            {mode === "sendBack" ? "What needs fixing? Your kid will see this." : "Why are you rejecting it? (No money, it won't come back.)"}
          </p>
          {mode === "sendBack" ? (
            <div className="flex flex-wrap gap-2">
              {(locale === "fr" ? QUICK_FR : QUICK).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setComment(q)}
                  className={`min-h-10 rounded-full px-4 text-sm font-bold ${comment === q ? "bg-plum text-white" : "bg-card text-ink ring-1 ring-line"}`}
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Type a message…" maxLength={300} autoFocus />
          <div className="flex gap-2">
            <Button type="submit" variant={mode === "reject" ? "danger" : "primary"} disabled={!comment.trim() || pending}>
              {mode === "sendBack" ? "Send back" : "Reject"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setMode("idle"); setComment(""); }}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
