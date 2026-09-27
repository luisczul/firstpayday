"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChoreCard, type ChoreCardData } from "./ChoreCard";
import { ChecklistProgress } from "./ChecklistProgress";
import { checklistProgress, groupSubtasks, type Subtask } from "@/lib/schedule/checklist";
import { formatMoney } from "@/lib/money/format";
import { translator, type Locale } from "@/lib/i18n";

export interface ConfirmTarget extends ChoreCardData {
  maxQuantity: number;
  noteForKids: string | null;
  mode: "submit" | "resubmit";
  reviewComment?: string | null;
  choreId?: string;
  /** Checklist chore: steps and the ones already ticked this period. */
  checklist?: { subtasks: Subtask[]; done: string[] } | null;
}

export function ConfirmSheet({
  target,
  currency,
  locale,
  busy,
  onConfirm,
  onCancel,
  kidId,
  onStepsChange,
  onGiveUp,
}: {
  target: ConfirmTarget | null;
  currency: string;
  locale: Locale;
  busy: boolean;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
  /** Needed to save checklist ticks. */
  kidId?: string;
  /** Ticks changed (optimistic, then as saved), so the board card can follow. */
  onStepsChange?: (choreId: string, done: string[]) => void;
  /** Needs fixing only: the kid gives the chore up ("too hard for me"). */
  onGiveUp?: () => void;
}) {
  return (
    <AnimatePresence>
      {target ? (
        <SheetBody
          key={target.title}
          target={target}
          currency={currency}
          locale={locale}
          busy={busy}
          onConfirm={onConfirm}
          onCancel={onCancel}
          kidId={kidId}
          onStepsChange={onStepsChange}
          onGiveUp={onGiveUp}
        />
      ) : null}
    </AnimatePresence>
  );
}

function SheetBody({
  target,
  currency,
  locale,
  busy,
  onConfirm,
  onCancel,
  kidId,
  onStepsChange,
  onGiveUp,
}: {
  target: ConfirmTarget;
  currency: string;
  locale: Locale;
  busy: boolean;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
  kidId?: string;
  onStepsChange?: (choreId: string, done: string[]) => void;
  onGiveUp?: () => void;
}) {
  const tr = translator(locale);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [qty, setQty] = useState(1);
  const showStepper = target.mode === "submit" && target.maxQuantity > 1;
  const steps = target.checklist?.subtasks ?? [];
  // A sent-back checklist was already finished: its steps stay ticked (read-only).
  const [done, setDone] = useState<string[]>(() =>
    target.mode === "resubmit" ? steps.map((s) => s.id) : (target.checklist?.done ?? []),
  );
  const [stepError, setStepError] = useState(false);
  const seq = useRef(0);
  const inFlight = useRef(0);
  // "I did it!" waits until every tick is saved, so the server sees them all.
  const [saving, setSaving] = useState(0);
  // Follow the board's saved ticks, but never over a tap still being saved.
  const boardDone = (target.checklist?.done ?? []).join(",");
  useEffect(() => {
    if (target.mode !== "submit" || inFlight.current > 0) return;
    setDone(boardDone ? boardDone.split(",") : []);
  }, [boardDone, target.mode]);
  const progress = checklistProgress(steps, done);
  const locked = steps.length > 0 && target.mode === "submit" && !progress.complete;

  const toggle = async (id: string) => {
    if (target.mode !== "submit" || !kidId || !target.choreId) return;
    const choreId = target.choreId;
    const checked = !done.includes(id);
    const before = done;
    const update = (next: string[]) => {
      setDone(next);
      onStepsChange?.(choreId, next);
    };
    update(checked ? [...done, id] : done.filter((d) => d !== id));
    setStepError(false);
    const mine = ++seq.current;
    inFlight.current += 1;
    setSaving((n) => n + 1);
    try {
      const res = await fetch("/api/kiosk/subtask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidId, choreId: target.choreId, subtaskId: id, checked }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; checked?: string[] };
      if (!res.ok || !body.ok) throw new Error("toggle failed");
      // The server's list wins (another tablet may have ticked too), unless a newer tap is on its way.
      if (mine === seq.current) update(body.checked ?? []);
    } catch {
      if (mine === seq.current) update(before);
      setStepError(true);
    } finally {
      inFlight.current -= 1;
      setSaving((n) => n - 1);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/45 p-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={target.title}
        className={
          steps.length
            ? // Routine: card and buttons on the left, the steps use the whole right side (phones: card, steps, buttons).
              "grid max-h-[92dvh] w-full max-w-5xl gap-6 overflow-y-auto rounded-[2rem] bg-paper p-6 shadow-[var(--shadow-pop)] [grid-template-areas:'card'_'steps'_'actions'] md:grid-cols-2 md:grid-rows-[auto_1fr] md:overflow-hidden md:p-8 md:[grid-template-areas:'card_steps'_'actions_steps']"
            : "flex w-full max-w-4xl flex-col gap-6 rounded-[2rem] bg-paper p-6 shadow-[var(--shadow-pop)] md:flex-row md:p-8"
        }
        initial={{ y: 60, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={steps.length ? "[grid-area:card]" : "md:w-1/2"}>
          <ChoreCard
            chore={target}
            currency={currency}
            locale={locale}
            perLabel={target.unitLabel ? tr("kid.per", { unit: target.unitLabel }) : undefined}
            size="lg"
          />
          {target.noteForKids ? (
            <p className="mt-4 rounded-2xl bg-gold/30 px-5 py-3 text-lg font-semibold text-ink">💬 {target.noteForKids}</p>
          ) : null}
          {steps.length && target.mode === "resubmit" && target.reviewComment ? (
            <div className="relative mt-4 rounded-3xl bg-card px-6 py-4 text-xl font-bold text-plum ring-2 ring-plum/30">
              “{target.reviewComment}”
            </div>
          ) : null}
        </div>

        <div className={steps.length ? "contents" : "flex flex-col justify-center gap-5 md:w-1/2"}>
          {!steps.length && target.mode === "resubmit" && target.reviewComment ? (
            <div className="relative rounded-3xl bg-card px-6 py-4 text-xl font-bold text-plum ring-2 ring-plum/30">
              “{target.reviewComment}”
            </div>
          ) : null}

          {steps.length ? (
            <div className="flex min-h-0 flex-col gap-3 rounded-3xl bg-card p-4 ring-1 ring-line [grid-area:steps] md:max-h-[84dvh]">
              <ChecklistProgress done={progress.done} total={progress.total} locale={locale} size="lg" />
              {target.mode === "submit" ? <p className="text-lg font-semibold text-ink-soft">{tr("kid.stepsHint")}</p> : null}
              <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1" role="group" aria-label={tr("kid.steps", { done: progress.done, total: progress.total })}>
                {groupSubtasks(steps).map((g, gi) => (
                  <div key={`${g.section ?? ""}-${gi}`} className="flex flex-col gap-2">
                    {g.section ? <h3 className="mt-1 font-display text-2xl font-extrabold text-ink">{g.section}</h3> : null}
                    {g.items.map((s) => {
                      const on = done.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          disabled={target.mode !== "submit"}
                          onClick={() => void toggle(s.id)}
                          className={`flex min-h-16 w-full items-center gap-4 rounded-2xl px-4 py-2 text-left text-2xl font-bold transition active:scale-[0.98] ${
                            on ? "bg-moss/15 text-moss ring-2 ring-moss" : "bg-paper text-ink ring-1 ring-line"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-3xl font-black ${
                              on ? "bg-moss text-white" : "bg-card ring-2 ring-line"
                            }`}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span className={on ? "line-through decoration-2 opacity-80" : ""}>{s.title}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              {stepError ? <p className="text-lg font-bold text-plum">{tr("kid.oops")}</p> : null}
            </div>
          ) : null}

          <div className={steps.length ? "flex flex-col gap-5 [grid-area:actions]" : "contents"}>
          {steps.length && target.mode === "submit" ? (
            <p aria-live="polite" className={`text-center text-2xl font-black ${locked ? "text-amber" : "text-moss"}`}>
              {progress.remaining > 1
                ? tr("kid.stepsLeft", { count: progress.remaining })
                : progress.remaining === 1
                  ? tr("kid.stepsLeftOne")
                  : tr("kid.stepsAllDone")}
            </p>
          ) : null}

          {showStepper ? (
            <div className="rounded-3xl bg-card p-5 ring-1 ring-line">
              <p className="text-center text-2xl font-extrabold text-ink">
                {target.unitLabel ? tr("kid.howMany", { unit: target.unitLabel }) : tr("kid.howManyPlain")}
              </p>
              <div className="mt-4 flex items-center justify-center gap-6">
                <StepButton label="−" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} />
                <span className="w-20 text-center font-display text-7xl font-extrabold text-ink" aria-live="polite">
                  {qty}
                </span>
                <StepButton
                  label="+"
                  disabled={qty >= target.maxQuantity}
                  onClick={() => setQty((q) => Math.min(target.maxQuantity, q + 1))}
                />
              </div>
              <p className="mt-3 text-center text-3xl font-black text-moss">
                = {formatMoney(qty * target.priceCents, currency, locale)}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy || locked || saving > 0}
            onClick={() => onConfirm(qty)}
            className="min-h-24 rounded-3xl bg-moss px-8 text-4xl font-black text-white shadow-[0_6px_0_#4a5620] transition-transform active:translate-y-1 active:shadow-[0_2px_0_#4a5620] disabled:opacity-60"
          >
            {target.mode === "resubmit" ? `${tr("kid.fixedIt")} 🔧` : tr("kid.didIt")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-16 rounded-2xl text-2xl font-bold text-ink-soft active:bg-paper-deep"
          >
            {tr("kid.notYet")}
          </button>
          {target.mode === "resubmit" && onGiveUp ? (
            confirmGiveUp ? (
              <div className="flex flex-col gap-3 rounded-3xl bg-paper-deep p-4 text-center">
                <p className="text-xl font-bold text-ink">{tr("kid.giveUpSure")}</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onGiveUp}
                    className="min-h-16 flex-1 rounded-2xl bg-plum px-4 text-xl font-black text-white active:scale-95 disabled:opacity-60"
                  >
                    {tr("kid.giveUpYes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmGiveUp(false)}
                    className="min-h-16 flex-1 rounded-2xl bg-card px-4 text-xl font-bold text-ink ring-1 ring-line active:scale-95"
                  >
                    {tr("kid.giveUpKeep")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmGiveUp(true)}
                className="min-h-16 rounded-2xl text-xl font-bold text-plum underline-offset-4 active:bg-paper-deep"
              >
                😅 {tr("kid.giveUp")}
              </button>
            )
          ) : null}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StepButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label === "+" ? "More" : "Less"}
      className="flex h-20 w-20 items-center justify-center rounded-full bg-amber text-5xl font-black text-white shadow-[0_5px_0_#a8620f] active:translate-y-1 active:shadow-[0_1px_0_#a8620f] disabled:opacity-35"
    >
      {label}
    </button>
  );
}
