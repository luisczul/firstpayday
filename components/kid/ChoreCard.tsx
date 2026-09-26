"use client";

import type { ReactNode } from "react";
import { formatPrice } from "@/lib/money/format";

export type ChoreCardVariant = "ready" | "new" | "fix" | "waiting" | "soon" | "admin";

export interface ChoreCardData {
  title: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  priceCents: number;
  unitLabel: string | null;
}

/**
 * The chore card kids see (SPEC §6 "Card anatomy"): colored stripe on the
 * left, big emoji, big title, 1–2 line description, price chip top-right.
 * The admin grid reuses it so parents see exactly what kids see.
 */
export function ChoreCard({
  chore,
  variant = "ready",
  currency,
  locale,
  perLabel,
  badge,
  footer,
  onPress,
  pressLabel,
  size = "md",
  priceSlot,
}: {
  chore: ChoreCardData;
  variant?: ChoreCardVariant;
  currency: string;
  locale: string;
  /** Localized "/ floor" text when a unit label exists. */
  perLabel?: string;
  badge?: ReactNode;
  footer?: ReactNode;
  onPress?: () => void;
  pressLabel?: string;
  size?: "md" | "lg";
  /** Replaces the price chip (admin inline price edit). */
  priceSlot?: ReactNode;
}) {
  const color = chore.color ?? "#E08A1E";
  const dim = variant === "waiting" || variant === "soon";
  const big = size === "lg";

  const body = (
    <>
      <span aria-hidden className="absolute inset-y-0 left-0 w-3" style={{ background: color }} />
      <span className="absolute top-4 right-4 z-10">
        {priceSlot ?? (
          <span className="inline-flex items-center rounded-full bg-gold px-3.5 py-1.5 text-lg font-black text-ink shadow-[0_2px_0_rgb(59_36_24/0.15)]">
            {formatPrice(chore.priceCents, currency, locale)}
            {chore.unitLabel && perLabel ? (
              <span className="ml-1 text-sm font-bold text-ink-soft">{perLabel}</span>
            ) : null}
          </span>
        )}
      </span>
      {badge ? <span className="absolute top-4 left-7 z-10">{badge}</span> : null}

      <span className={`flex h-full flex-col pl-7 pr-5 ${big ? "pt-16 pb-7" : "pt-14 pb-5"}`}>
        <span
          aria-hidden
          className={`mb-3 inline-flex items-center justify-center rounded-2xl ${big ? "h-24 w-24 text-6xl" : "h-16 w-16 text-4xl"}`}
          style={{ background: `${color}1f` }}
        >
          {chore.emoji || "⭐"}
        </span>
        <span className={`font-display font-bold leading-tight text-ink ${big ? "text-4xl" : "text-2xl"}`}>
          {chore.title}
        </span>
        {chore.description ? (
          <span
            className={`mt-2 text-ink-soft ${big ? "text-xl leading-snug" : "line-clamp-2 text-base leading-snug"}`}
          >
            {chore.description}
          </span>
        ) : null}
        {footer ? <span className="mt-auto pt-3">{footer}</span> : null}
      </span>
    </>
  );

  const shell = `relative block overflow-hidden rounded-[var(--radius-card)] bg-card text-left shadow-[var(--shadow-card)] ring-1 ring-line ${
    big ? "w-full min-h-[340px]" : variant === "admin" ? "w-full h-[300px]" : "w-[272px] h-[300px] shrink-0"
  } ${dim ? "opacity-70 saturate-[0.6]" : ""}`;

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        aria-label={pressLabel ?? chore.title}
        className={`${shell} transition-transform active:scale-[0.97] min-h-16`}
      >
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}
