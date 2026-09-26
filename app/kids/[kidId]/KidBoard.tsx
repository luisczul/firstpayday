"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChoreCard } from "@/components/kid/ChoreCard";
import { ConfirmSheet, type ConfirmTarget } from "@/components/kid/ConfirmSheet";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { SectionRow } from "@/components/kid/SectionRow";
import { KidToast } from "@/components/kid/Toast";
import { fireConfetti, playChime, useIdle, usePolling, useSoundPref, useWakeLock } from "@/components/kid/hooks";
import { formatMoney } from "@/lib/money/format";
import { translator, weekdayName, type Locale } from "@/lib/i18n";
import type { BoardCard } from "@/lib/board/buildBoard";
import type { KioskBoard, KidHistoryItem } from "@/lib/kiosk/operations";

type Pending = { card: BoardCard; mode: "submit" | "resubmit"; key: string };

export function KidBoard({ initial }: { initial: KioskBoard }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [board, setBoard] = useState(initial);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "happy" | "sad" } | null>(null);
  const [showMoney, setShowMoney] = useState(false);
  const [soundOn, setSoundOn] = useSoundPref();
  const toastTimer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);

  const { household, kid, sections } = board;
  const locale = household.locale;
  const tr = translator(locale);
  const money = (c: number) => formatMoney(c, household.currency, locale);

  useWakeLock();
  useIdle(household.kidIdleSeconds, () => router.push("/kids"));

  const showToast = (text: string, tone: "happy" | "sad" = "happy") => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    const qs = new URLSearchParams({ kidId: initial.kid.id });
    if (initial.seenBefore) qs.set("seenBefore", initial.seenBefore);
    const res = await fetch(`/api/kiosk/board?${qs}`, { cache: "no-store" });
    if (res.status === 401 || res.status === 404) return router.replace("/kids");
    if (res.ok && !inFlight.current) setBoard(await res.json());
  }, [initial.kid.id, initial.seenBefore, router]);
  usePolling(refresh, 4000);

  const open = (card: BoardCard, mode: "submit" | "resubmit") => {
    if (household.paused) return showToast(tr("kid.paused"), "sad");
    setPending({ card, mode, key: crypto.randomUUID() });
  };

  const confirm = async (quantity: number) => {
    if (!pending || busy) return;
    const { card, mode, key } = pending;
    setBusy(true);
    inFlight.current = true;

    // Optimistic: move the card straight to "Waiting for check".
    const before = board;
    const amount = mode === "resubmit" ? (card.submission?.amountCents ?? 0) : quantity * card.priceCents;
    const waitingCard: BoardCard = {
      ...card,
      state: "pending",
      submission: {
        id: card.submission?.id ?? key,
        quantity,
        amountCents: amount,
        reviewComment: null,
        submittedAt: new Date().toISOString(),
      },
    };
    setBoard({
      ...board,
      kid: { ...kid, pendingCents: kid.pendingCents + amount },
      sections: {
        ...sections,
        new: sections.new.filter((c) => c.choreId !== card.choreId),
        ready: sections.ready.filter((c) => c.choreId !== card.choreId),
        fix: sections.fix.filter((c) => c.submission?.id !== card.submission?.id),
        waiting: [waitingCard, ...sections.waiting],
      },
    });
    setPending(null);
    if (mode === "submit") {
      void fireConfetti();
      if (soundOn) playChime();
    }

    try {
      const res =
        mode === "submit"
          ? await fetch("/api/kiosk/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                kidId: kid.id,
                choreId: card.choreId,
                quantity,
                idempotencyKey: key,
                expectedLastId: card.expectedLastId,
              }),
            })
          : await fetch("/api/kiosk/resubmit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kidId: kid.id, submissionId: card.submission!.id }),
            });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      if (res.ok && body.ok) {
        if (mode === "resubmit") {
          void fireConfetti();
          if (soundOn) playChime();
        }
        showToast(mode === "submit" ? tr("kid.sent") : tr("kid.resent"));
      } else {
        setBoard(before);
        showToast(
          body.reason === "taken" ? tr("kid.taken") : body.reason === "paused" ? tr("kid.paused") : tr("kid.oops"),
          "sad",
        );
      }
    } catch {
      setBoard(before);
      showToast(tr("kid.oops"), "sad");
    } finally {
      inFlight.current = false;
      setBusy(false);
      void refresh();
    }
  };

  const perLabel = (c: BoardCard) => (c.unitLabel ? tr("kid.per", { unit: c.unitLabel }) : undefined);
  const nothingToDo = sections.new.length + sections.fix.length + sections.ready.length === 0;

  const cardMotion = reduceMotion
    ? {}
    : {
        layout: true,
        initial: { opacity: 0, scale: 0.85, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.8 },
        transition: { type: "spring" as const, stiffness: 300, damping: 24 },
      };

  const target: ConfirmTarget | null = pending
    ? {
        ...pending.card,
        mode: pending.mode,
        reviewComment: pending.card.submission?.reviewComment ?? null,
      }
    : null;

  return (
    <main className="min-h-dvh pb-10">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-5 bg-paper/90 px-6 py-4 backdrop-blur">
        <button
          type="button"
          onClick={() => router.push("/kids")}
          className="flex min-h-16 min-w-16 items-center justify-center rounded-full bg-card text-3xl shadow-[var(--shadow-card)] active:scale-95"
          aria-label={tr("kid.back")}
        >
          ←
        </button>
        <KidAvatar name={kid.name} color={kid.color} avatarUrl={kid.avatarUrl} size={76} />
        <h1 className="font-display text-5xl font-extrabold text-ink">{kid.name}</h1>

        <div className="ml-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSoundOn(!soundOn)}
            className="flex min-h-16 min-w-16 items-center justify-center rounded-full bg-card text-2xl shadow-[var(--shadow-card)]"
            aria-label={tr("kid.sound")}
            aria-pressed={soundOn}
          >
            {soundOn ? "🔊" : "🔈"}
          </button>
          <button
            type="button"
            onClick={() => setShowMoney(true)}
            className="flex min-h-16 flex-col items-end rounded-3xl bg-card px-6 py-2 shadow-[var(--shadow-card)] active:scale-[0.98]"
            aria-label={tr("kid.myMoney")}
          >
            <span className="font-display text-4xl font-extrabold leading-tight text-moss">
              {money(kid.balanceCents)} <span className="font-sans text-lg font-bold text-ink-soft">{tr("kid.inMyBank")}</span>
            </span>
            {kid.pendingCents > 0 ? (
              <span className="text-lg font-bold text-amber">{tr("kid.waitingForCheck", { amount: money(kid.pendingCents) })}</span>
            ) : null}
          </button>
        </div>
      </header>

      {household.paused ? (
        <p className="mx-8 mt-2 rounded-3xl bg-plum px-6 py-4 text-center text-2xl font-bold text-white">{tr("kid.paused")}</p>
      ) : null}

      <AnimatePresence initial={false}>
        {sections.fix.length > 0 ? (
          <SectionRow key="fix" title={tr("kid.section.fix")} count={sections.fix.length} tone="fix">
            <AnimatePresence mode="popLayout">
              {sections.fix.map((c) => (
                <motion.div key={`fix-${c.submission?.id}`} {...cardMotion} className="snap-start">
                  <ChoreCard
                    chore={c}
                    variant="fix"
                    currency={household.currency}
                    locale={locale}
                    perLabel={perLabel(c)}
                    onPress={() => open(c, "resubmit")}
                    footer={
                      <span className="flex flex-col gap-3">
                        {c.submission?.reviewComment ? (
                          <span className="relative rounded-2xl bg-plum/10 px-4 py-2 text-lg font-bold text-plum">
                            💬 {c.submission.reviewComment}
                          </span>
                        ) : null}
                        <span className="flex min-h-16 items-center justify-center rounded-2xl bg-plum text-2xl font-black text-white">
                          {tr("kid.fixedIt")}
                        </span>
                      </span>
                    }
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </SectionRow>
        ) : null}
      </AnimatePresence>

      {sections.new.length > 0 ? (
        <SectionRow title={tr("kid.section.new")} count={sections.new.length} tone="new">
          <AnimatePresence mode="popLayout">
            {sections.new.map((c) => (
              <motion.div key={c.choreId} {...cardMotion} className="snap-start">
                <ChoreCard
                  chore={c}
                  variant="new"
                  currency={household.currency}
                  locale={locale}
                  perLabel={perLabel(c)}
                  onPress={() => open(c, "submit")}
                  badge={
                    <span className="inline-flex animate-pulse items-center rounded-full bg-maple px-3 py-1 text-sm font-black tracking-wide text-white uppercase">
                      ✨ {tr("kid.new")}
                    </span>
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SectionRow>
      ) : null}

      {sections.ready.length > 0 ? (
        <SectionRow title={tr("kid.section.ready")} count={sections.ready.length}>
          <AnimatePresence mode="popLayout">
            {sections.ready.map((c) => (
              <motion.div key={c.choreId} {...cardMotion} className="snap-start">
                <ChoreCard
                  chore={c}
                  currency={household.currency}
                  locale={locale}
                  perLabel={perLabel(c)}
                  onPress={() => open(c, "submit")}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SectionRow>
      ) : null}

      {nothingToDo ? (
        <div className="mx-8 my-6 flex flex-col items-center rounded-[2rem] bg-card px-8 py-10 text-center shadow-[var(--shadow-card)]">
          <span className="text-7xl" aria-hidden>🎉</span>
          <p className="mt-3 font-display text-4xl font-bold text-ink">{tr("kid.allDone")}</p>
          <p className="mt-2 text-xl text-ink-soft">{tr("kid.allDoneSub")}</p>
        </div>
      ) : null}

      {sections.waiting.length > 0 ? (
        <SectionRow title={tr("kid.section.waiting")} count={sections.waiting.length}>
          <AnimatePresence mode="popLayout">
            {sections.waiting.map((c) => (
              <motion.div key={`w-${c.submission?.id}`} {...cardMotion} className="snap-start">
                <ChoreCard
                  chore={{ ...c, priceCents: c.submission?.amountCents ?? c.priceCents, unitLabel: null }}
                  variant="waiting"
                  currency={household.currency}
                  locale={locale}
                  footer={<span className="text-lg font-bold text-amber">⏳ {tr("kid.parentWillCheck")}</span>}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SectionRow>
      ) : null}

      {sections.soon.length > 0 ? (
        <SectionRow title={tr("kid.section.soon")} count={sections.soon.length}>
          {sections.soon.map((c) => (
            <div key={c.choreId} className="snap-start">
              <ChoreCard
                chore={c}
                variant="soon"
                currency={household.currency}
                locale={locale}
                perLabel={perLabel(c)}
                footer={<span className="text-lg font-extrabold text-plum">🌙 {backLabel(c, locale)}</span>}
              />
            </div>
          ))}
        </SectionRow>
      ) : null}

      <ConfirmSheet
        target={target}
        currency={household.currency}
        locale={locale}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
      <KidToast message={toast?.text ?? null} tone={toast?.tone} />
      {showMoney ? <MoneySheet board={board} onClose={() => setShowMoney(false)} /> : null}
    </main>
  );
}

function backLabel(card: BoardCard, locale: Locale): string {
  const tr = translator(locale);
  const cb = card.comingBack;
  if (!cb) return "";
  if (cb.kind === "tomorrow") return tr("kid.backTomorrow");
  if (cb.kind === "weekday") return tr("kid.backWeekday", { weekday: weekdayName(locale, cb.weekday) });
  return tr("kid.backInDays", { days: cb.days });
}

function MoneySheet({ board, onClose }: { board: KioskBoard; onClose: () => void }) {
  const { household, kid } = board;
  const tr = translator(household.locale);
  const [items, setItems] = useState<KidHistoryItem[] | null>(null);
  useEffect(() => {
    void fetch(`/api/kiosk/history?kidId=${kid.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: KidHistoryItem[] }) => setItems(d.items));
  }, [kid.id]);
  const money = (c: number) => formatMoney(c, household.currency, household.locale);
  const icon: Record<string, string> = { earning: "⭐", match: "🎁", payout: "💵", adjustment: "✏️" };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/45 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-paper p-8 shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-4xl font-extrabold text-ink">{tr("kid.myMoney")}</h2>
          <span className="font-display text-4xl font-extrabold text-moss">{money(kid.balanceCents)}</span>
        </div>
        <p className="mt-6 text-xl font-bold text-ink-soft">{tr("kid.recent")}</p>
        <ul className="mt-2 divide-y divide-line">
          {(items ?? []).map((i) => (
            <li key={i.id} className="flex items-center gap-4 py-3 text-xl">
              <span aria-hidden className="text-3xl">{icon[i.kind] ?? "•"}</span>
              <span className="flex-1 font-semibold text-ink">{i.note ?? i.kind}</span>
              <span className={`font-black ${i.amountCents < 0 ? "text-plum" : "text-moss"}`}>
                {i.amountCents > 0 ? "+" : ""}
                {money(i.amountCents)}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="mt-6 min-h-16 w-full rounded-2xl bg-maple text-2xl font-black text-white">
          OK
        </button>
      </div>
    </div>
  );
}
