"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CURRENCY_COPY, currencyOptions, currencySymbol } from "@/lib/money/currencies";
import { useParentT } from "@/lib/i18n/parent/client";

/** Lower case without accents, so "rupia" finds "Rúpia" and "inr" finds "INR". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Household currency picker: every 2-decimal currency, named in the parent's language. A long
 * native list was hard to scroll through on a phone (QA FPI_001), so it opens a sheet with a
 * search box (name, code or symbol), the selected one and the most used ones first, then A to Z
 * with a letter index. The sheet closes with ✕, a tap on the dimmed background, Escape, or a swipe
 * down on its handle.
 *
 * The sheet is rendered on <body>, not where the button is: the button sits inside a form field's
 * <label>, and a tap anywhere inside a label "clicks" its button, so tapping the background
 * reopened the sheet straight away (QA FPI_007).
 */
export function CurrencySelect({ value, onChange, locale }: { value: string; onChange: (code: string) => void; locale: string }) {
  const t = useParentT();
  // The full list comes from Intl, which differs between the server's Node and each browser
  // (HUF has 2 decimals in one and 0 in the other), so it is built after hydration only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const all = useMemo(
    () => currencyOptions(locale).map((o) => ({ ...o, symbol: currencySymbol(o.code, locale) })),
    [locale],
  );
  const options = mounted ? all : all.filter((o) => o.common);
  const copy = CURRENCY_COPY[locale] ?? CURRENCY_COPY.en!;
  const current = options.find((o) => o.code === value);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  // Swipe down on the handle to close: how far the sheet has been dragged.
  const [drag, setDrag] = useState<{ start: number; dy: number } | null>(null);
  const close = () => {
    setOpen(false);
    setQuery("");
    setDrag(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const q = fold(query.trim());
  const matches = q
    ? options.filter((o) => fold(`${o.code} ${o.name}`).includes(q) || o.symbol === query.trim())
    : null;
  const rest = options.filter((o) => !o.common);
  const letters = [...new Set(rest.map((o) => o.code[0]!))];

  const pick = (code: string) => {
    onChange(code);
    close();
  };
  const row = (o: (typeof options)[number], id?: string) => (
    <button
      key={o.code}
      id={id}
      type="button"
      role="option"
      aria-selected={o.code === value}
      onClick={() => pick(o.code)}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${o.code === value ? "bg-amber/15 ring-1 ring-amber" : "hover:bg-paper-deep"}`}
    >
      <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-paper-deep px-1.5 text-sm font-black text-ink">{o.symbol}</span>
      <span className="w-12 shrink-0 font-black text-ink">{o.code}</span>
      <span className="min-w-0 flex-1 truncate text-ink-soft">{o.name}</span>
      {o.code === value ? <span aria-hidden className="font-black text-moss">✓</span> : null}
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid="currency-picker"
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-line bg-card px-3 text-left text-base text-ink focus:border-amber focus:ring-2 focus:ring-amber/40 focus:outline-none"
      >
        <span className="shrink-0 font-black">{current?.symbol ?? value}</span>
        <span className="min-w-0 flex-1 truncate">{current?.label ?? value}</span>
        <span aria-hidden className="shrink-0 text-ink-soft">▾</span>
      </button>

      {open ? createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center" data-testid="currency-backdrop" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={copy.all}
            onClick={(e) => e.stopPropagation()}
            style={drag ? { transform: `translateY(${Math.max(0, drag.dy)}px)`, transition: "none" } : undefined}
            className="flex h-[85dvh] w-full flex-col rounded-t-3xl bg-paper pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-pop)] transition-transform md:h-[70vh] md:max-w-lg md:rounded-3xl"
          >
            {/* Handle: drag it down to close (phones). */}
            <div
              data-testid="currency-handle"
              className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 md:hidden"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDrag({ start: e.clientY, dy: 0 });
              }}
              onPointerMove={(e) => drag && setDrag({ start: drag.start, dy: e.clientY - drag.start })}
              onPointerUp={() => (drag && drag.dy > 80 ? close() : setDrag(null))}
              onPointerCancel={() => setDrag(null)}
            >
              <span aria-hidden className="h-1.5 w-10 rounded-full bg-line" />
            </div>
            <div className="flex items-center gap-2 border-b border-line px-4 pt-1 pb-3 md:pt-3">
              <input
                type="search"
                autoFocus={!window.matchMedia("(pointer: coarse)").matches}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.search}
                aria-label={copy.search}
                enterKeyHint="search"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 text-base text-ink focus:border-amber focus:ring-2 focus:ring-amber/40 focus:outline-none"
              />
              <button type="button" onClick={close} className="min-h-11 min-w-11 rounded-full text-xl text-ink-soft hover:bg-paper-deep" aria-label={t("a.common.close")}>
                ✕
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1">
              <div ref={listRef} role="listbox" aria-label={copy.all} className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 pr-8">
                {matches ? (
                  matches.length ? matches.map((o) => row(o)) : <p className="px-3 py-6 text-center font-bold text-ink-soft">{copy.none}</p>
                ) : (
                  <>
                    {current && !current.common ? (
                      <>
                        <h3 className="px-3 pt-2 pb-1 text-xs font-black tracking-wide text-ink-soft uppercase">{copy.selected}</h3>
                        {row(current)}
                      </>
                    ) : null}
                    <h3 className="px-3 pt-2 pb-1 text-xs font-black tracking-wide text-ink-soft uppercase">{copy.common}</h3>
                    {options.filter((o) => o.common).map((o) => row(o))}
                    <h3 className="px-3 pt-4 pb-1 text-xs font-black tracking-wide text-ink-soft uppercase">{copy.all}</h3>
                    {rest.map((o, i) => row(o, i === 0 || rest[i - 1]!.code[0] !== o.code[0] ? `cur-${o.code[0]}` : undefined))}
                  </>
                )}
              </div>
              {/* A to Z index: tap (or slide a finger along) a letter to jump there. */}
              {!matches && letters.length > 1 ? (
                <nav
                  aria-label="A–Z"
                  className="absolute top-1 right-0.5 bottom-1 flex touch-none flex-col items-center justify-between py-1 text-[0.65rem] font-black text-maple select-none"
                  onPointerMove={(e) => {
                    if (e.buttons === 0 && e.pointerType === "mouse") return;
                    const el = document.elementFromPoint(e.clientX, e.clientY);
                    const l = el instanceof HTMLElement ? el.dataset.letter : undefined;
                    if (l) document.getElementById(`cur-${l}`)?.scrollIntoView({ block: "start" });
                  }}
                >
                  {letters.map((l) => (
                    <button
                      key={l}
                      type="button"
                      data-letter={l}
                      onClick={() => document.getElementById(`cur-${l}`)?.scrollIntoView({ block: "start" })}
                      className="flex w-6 flex-1 items-center justify-center"
                    >
                      {l}
                    </button>
                  ))}
                </nav>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
