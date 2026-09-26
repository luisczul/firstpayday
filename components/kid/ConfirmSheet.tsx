"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChoreCard, type ChoreCardData } from "./ChoreCard";
import { formatMoney } from "@/lib/money/format";
import { translator, type Locale } from "@/lib/i18n";

export interface ConfirmTarget extends ChoreCardData {
  maxQuantity: number;
  noteForKids: string | null;
  mode: "submit" | "resubmit";
  reviewComment?: string | null;
}

export function ConfirmSheet({
  target,
  currency,
  locale,
  busy,
  onConfirm,
  onCancel,
}: {
  target: ConfirmTarget | null;
  currency: string;
  locale: Locale;
  busy: boolean;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
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
}: {
  target: ConfirmTarget;
  currency: string;
  locale: Locale;
  busy: boolean;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}) {
  const tr = translator(locale);
  const [qty, setQty] = useState(1);
  const showStepper = target.mode === "submit" && target.maxQuantity > 1;

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
        className="flex w-full max-w-4xl flex-col gap-6 rounded-[2rem] bg-paper p-6 shadow-[var(--shadow-pop)] md:flex-row md:p-8"
        initial={{ y: 60, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:w-1/2">
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
        </div>

        <div className="flex flex-col justify-center gap-5 md:w-1/2">
          {target.mode === "resubmit" && target.reviewComment ? (
            <div className="relative rounded-3xl bg-card px-6 py-4 text-xl font-bold text-plum ring-2 ring-plum/30">
              “{target.reviewComment}”
            </div>
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
            disabled={busy}
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
