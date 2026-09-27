"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChoreCard } from "@/components/kid/ChoreCard";
import { ConfirmSheet, type ConfirmTarget } from "@/components/kid/ConfirmSheet";
import { ChecklistProgress } from "@/components/kid/ChecklistProgress";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { SectionRow } from "@/components/kid/SectionRow";
import { KidToast } from "@/components/kid/Toast";
import { PromoBanner } from "@/components/kid/PromoBanner";
import { bestPromo } from "@/lib/money/promotions";
import { fireConfetti, playChime, useIdle, usePolling, useSoundPref, useWakeLock } from "@/components/kid/hooks";
import { localizeLedgerNote } from "@/lib/i18n/ledgerNotes";
import { formatMoney, formatPrice } from "@/lib/money/format";
import { intlLocale, translator, weekdayName, type Locale } from "@/lib/i18n";
import { claimDeadline, claimTimeLeft } from "@/lib/schedule/claims";
import type { BoardCard } from "@/lib/board/buildBoard";
import type { KioskBoard, KidHistoryItem } from "@/lib/kiosk/operations";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/templates";

type Pending = { card: BoardCard; mode: "submit" | "resubmit"; key: string };

export function KidBoard({ initial }: { initial: KioskBoard }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [board, setBoard] = useState(initial);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "happy" | "sad" } | null>(null);
  const [showMoney, setShowMoney] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"parent" | "asc" | "desc">("parent");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [soundOn, setSoundOn] = useSoundPref();
  // "⏰ Garage sweep went back on the board": shown once, when the board opens.
  const [nudges, setNudges] = useState(initial.expiredClaims ?? []);
  // Claim countdowns tick every half minute, and whenever the board changes.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    setClock(Date.now());
    const id = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [board]);
  const toastTimer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);

  const { household, kid, sections } = board;
  const locale = household.locale;
  const tr = translator(locale);
  const money = (c: number) => formatMoney(c, household.currency, locale);
  // Live promotion: a "+$1 bonus" chip on each card the kid can do now.
  const promoBadge = (c: BoardCard) => {
    const best = bestPromo(board.promos ?? [], new Date(board.now), c.priceCents);
    return best ? (
      <span className="inline-flex items-center rounded-full bg-maple px-2.5 py-1 text-[13px] font-black whitespace-nowrap text-white shadow-[0_2px_0_#8a3217]">
        🎉 {tr("kid.promoBadge", { amount: formatPrice(best.bonusCents, household.currency, locale) })}
      </span>
    ) : null;
  };

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

  // A sent-back chore that turned out too hard: take it off Needs fixing (it's free again for everyone).
  const giveUp = async () => {
    const submissionId = pending?.card.submission?.id;
    if (!pending || busy || !submissionId) return;
    setBusy(true);
    inFlight.current = true;
    const before = board;
    setBoard({ ...board, sections: { ...board.sections, fix: board.sections.fix.filter((c) => c.submission?.id !== submissionId) } });
    setPending(null);
    try {
      const res = await fetch("/api/kiosk/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidId: kid.id, submissionId }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && body.ok) showToast(tr("kid.gaveUp"));
      else {
        setBoard(before);
        showToast(tr("kid.oops"), "sad");
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

  // "I'm on it!": save a whole-house chore for this kid (it moves to In progress).
  const claim = async (quantity: number) => {
    const card = pending?.card;
    if (!card || busy) return;
    setBusy(true);
    inFlight.current = true;
    setPending(null);
    try {
      const res = await fetch("/api/kiosk/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidId: kid.id, choreId: card.choreId, quantity }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      if (res.ok && body.ok) {
        showToast(tr("kid.claimed"));
        if (soundOn) playChime();
        // "In progress" is the first section: bring the kid back up to see it.
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        showToast(
          body.reason === "limit"
            ? tr("kid.claimLimit")
            : body.reason === "claimed"
              ? tr("kid.claimedByOther")
              : body.reason === "taken"
                ? tr("kid.taken")
                : body.reason === "paused"
                  ? tr("kid.paused")
                  : tr("kid.oops"),
          "sad",
        );
      }
    } catch {
      showToast(tr("kid.oops"), "sad");
    } finally {
      inFlight.current = false;
      setBusy(false);
      void refresh();
    }
  };

  // "Give it back": the claimed chore is free again for everyone.
  const giveBack = async () => {
    const claimId = pending?.card.claim?.id;
    if (!pending || busy || !claimId) return;
    setBusy(true);
    inFlight.current = true;
    const before = board;
    const choreId = pending.card.choreId;
    setBoard({ ...board, sections: { ...board.sections, inProgress: board.sections.inProgress.filter((c) => c.choreId !== choreId) } });
    setPending(null);
    try {
      const res = await fetch("/api/kiosk/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidId: kid.id, claimId }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && body.ok) showToast(tr("kid.gaveBack"));
      else {
        setBoard(before);
        showToast(tr("kid.oops"), "sad");
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
        inProgress: sections.inProgress.filter((c) => c.choreId !== card.choreId),
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
          body.reason === "taken" ? tr("kid.taken") : body.reason === "claimed" ? tr("kid.claimedByOther") : body.reason === "paused" ? tr("kid.paused") : body.reason === "incomplete" ? tr("kid.checklistIncomplete") : tr("kid.oops"),
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
  // Checklist chores show how many steps are ticked this period; ticks made in the sheet show at once.
  const patchSteps = (choreId: string, done: string[]) => {
    const f = (c: BoardCard) => (c.choreId === choreId && c.checklist ? { ...c, checklist: { ...c.checklist, done } } : c);
    setBoard((b) => ({ ...b, sections: { ...b.sections, new: b.sections.new.map(f), ready: b.sections.ready.map(f) } }));
  };
  const stepsFooter = (c: BoardCard) =>
    c.checklist ? <ChecklistProgress done={c.checklist.done.length} total={c.checklist.subtasks.length} locale={locale} /> : undefined;
  const nothingToDo = sections.new.length + sections.fix.length + sections.ready.length + sections.inProgress.length === 0;

  // Claims ("I'm on it!"): countdown on my cards, a lock on a sibling's.
  const now = new Date(clock);
  const qtyLabel = (c: BoardCard) => {
    const q = c.claim?.quantity ?? 1;
    if (c.maxQuantity <= 1) return null;
    if (!c.unitLabel) return tr("kid.claimQtyPlain", { count: q });
    return q === 1 ? tr("kid.claimQtyOne", { unit: c.unitLabel }) : tr("kid.claimQtyMany", { count: q, unit: c.unitLabel });
  };
  const untilLabel = (expiresAt: string) => {
    const d = claimDeadline(expiresAt, now, intlLocale(locale), household.timezone);
    return d.kind === "end_of_day" ? tr("kid.claimUntilEndOfDay") : tr("kid.claimUntil", { time: d.kind === "today" ? d.time : `${d.weekday} ${d.time}` });
  };
  const claimFooter = (c: BoardCard) => {
    const left = claimTimeLeft(c.claim!.expiresAt, now);
    const qty = qtyLabel(c);
    return (
      <span className="flex flex-col gap-1" data-testid="claim-countdown">
        <span className={`text-xl font-black ${left.urgent ? "text-amber" : "text-moss"}`}>
          ⏳ {qty ? `${qty} · ` : ""}
          {left.hours > 0 ? tr("kid.claimLeftHours", { h: left.hours, m: left.minutes }) : tr("kid.claimLeftMinutes", { m: left.minutes })}
        </span>
        <span className="text-base font-bold text-ink-soft">{untilLabel(c.claim!.expiresAt)}</span>
      </span>
    );
  };
  const lockedBy = (c: BoardCard) => (c.claim && !c.claim.mine ? c.claim : null);
  const lockedFooter = (c: BoardCard) => {
    const qty = qtyLabel(c);
    return (
      <span className="text-lg font-extrabold text-plum" data-testid="claim-locked">
        {tr("kid.claimLockedBy", { name: c.claim!.kidName })}
        {qty ? ` · ${qty}` : ""} · {untilLabel(c.claim!.expiresAt)}
      </span>
    );
  };
  // A sibling's claimed chore stays on the board, locked: tapping explains why.
  const press = (c: BoardCard) => {
    const lock = lockedBy(c);
    if (lock) return showToast(tr("kid.claimLockedToast", { name: lock.kidName }), "sad");
    open(c, "submit");
  };

  // Category menu: only categories that currently have something to do.
  // Search matches the card text in the kid's own language, ignoring accents ("menage" finds "ménage").
  const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = fold(search).split(/\s+/).filter(Boolean);
  const matches = (c: BoardCard) => {
    const hay = fold(`${c.title} ${c.description ?? ""}`);
    return words.every((w) => hay.includes(w));
  };
  const inCategory = (c: BoardCard) => (category === "all" || c.category === category) && matches(c);
  const available = [...sections.new, ...sections.ready];
  const categoriesShown = CATEGORIES.filter((k) => available.some((c) => c.category === k));
  // Price sort: parent's order, then cheapest first, then biggest first.
  const sorted = (cards: BoardCard[]) =>
    sort === "parent" ? cards : [...cards].sort((a, b) => (sort === "asc" ? a.priceCents - b.priceCents : b.priceCents - a.priceCents));
  // Routines (chores with steps) get their own section at the top; regular chores follow.
  const isRoutine = (c: BoardCard) => Boolean(c.checklist);
  const newIds = new Set(sections.new.map((c) => c.choreId));
  const routinesShown = sorted([...sections.new, ...sections.ready].filter((c) => isRoutine(c) && inCategory(c)));
  const newShown = sorted(sections.new.filter((c) => !isRoutine(c) && inCategory(c)));
  const readyShown = sorted(sections.ready.filter((c) => !isRoutine(c) && inCategory(c)));
  const soonShown = sorted(sections.soon.filter(inCategory));
  const readyGroups =
    category === "all"
      ? CATEGORIES.map((k) => ({ key: k, cards: readyShown.filter((c) => c.category === k) })).filter((g) => g.cards.length)
      : [{ key: category, cards: readyShown }].filter((g) => g.cards.length);
  const catLabel = (k: string) => `${CATEGORY_LABELS[k]?.emoji ?? "⭐"} ${CATEGORY_LABELS[k]?.[locale] ?? k}`;

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
        // Live ticks (another tablet, or saves that landed after the sheet opened).
        checklist: [...sections.new, ...sections.ready].find((c) => c.choreId === pending.card.choreId)?.checklist ?? pending.card.checklist,
        claimable: pending.mode === "submit" && pending.card.claimable,
        claim: pending.card.claim?.mine ? { mine: true, quantity: pending.card.claim.quantity } : null,
      }
    : null;

  return (
    <main lang={locale} className="min-h-dvh pb-10">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-paper/90 backdrop-blur">
      <header className="flex items-center gap-4 px-6 py-3">
        <button
          type="button"
          onClick={() => router.push("/kids")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-ink shadow-[var(--shadow-card)] active:scale-95"
          aria-label={tr("kid.back")}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M11 6l-6 6 6 6" />
          </svg>
        </button>
        <KidAvatar name={kid.name} color={kid.color} avatarUrl={kid.avatarUrl} size={68} />
        <h1 className="font-display text-[2.7rem] leading-none font-extrabold text-ink">{kid.name}</h1>

        <div className="ml-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSoundOn(!soundOn)}
            className={`flex h-14 items-center justify-center gap-1.5 rounded-full px-4 text-base font-extrabold whitespace-nowrap shadow-[var(--shadow-card)] ${soundOn ? "bg-gold text-ink" : "bg-card text-ink-soft"}`}
            aria-label={tr("kid.sound")}
            aria-pressed={soundOn}
          >
            {/* Plays a little chime when a chore is done; this tablet only. */}
            <span aria-hidden className="text-xl">{soundOn ? "🔊" : "🔇"}</span>
            {soundOn ? tr("kid.soundOn") : tr("kid.soundOff")}
          </button>
          <button
            type="button"
            onClick={() => setShowMoney(true)}
            className="flex min-h-14 flex-col items-end rounded-3xl bg-card px-5 py-1.5 shadow-[var(--shadow-card)] active:scale-[0.98]"
            aria-label={tr("kid.myMoney")}
          >
            <span className="font-display text-[2rem] font-extrabold leading-tight text-moss">
              {money(kid.balanceCents)} <span className="font-sans text-lg font-bold text-ink-soft">{tr("kid.inMyBank")}</span>
            </span>
            {kid.pendingCents > 0 ? (
              <span className="text-lg font-bold text-amber">{tr("kid.waitingForCheck", { amount: money(kid.pendingCents) })}</span>
            ) : null}
          </button>
        </div>
      </header>
      {available.length > 1 ? (
        <nav
          aria-label={tr("kid.categories")}
          className="no-scrollbar flex gap-2.5 overflow-x-auto px-6 pb-3 md:px-8"
        >
          <button
            type="button"
            onClick={() => setSort((x) => (x === "parent" ? "asc" : x === "asc" ? "desc" : "parent"))}
            aria-label={tr("kid.sortLabel")}
            className={`flex min-h-14 shrink-0 items-center gap-2 rounded-full px-5 text-lg font-extrabold whitespace-nowrap transition active:scale-95 ${
              sort === "parent" ? "bg-card text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "bg-gold text-ink shadow-[0_4px_0_#b8860b]"
            }`}
          >
            {sort === "asc" ? `💰 ${tr("kid.sortAsc")}` : sort === "desc" ? `💰 ${tr("kid.sortDesc")}` : `💰 ${tr("kid.sortPrice")}`}
          </button>
          <span aria-hidden className="my-2 w-px shrink-0 bg-line" />
          {(categoriesShown.length > 1 ? ["all", ...categoriesShown] : []).map((k) => {
            const on = category === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setCategory(k)}
                aria-pressed={on}
                className={`flex min-h-14 shrink-0 items-center gap-2 rounded-full px-5 text-lg font-extrabold whitespace-nowrap transition active:scale-95 ${
                  on ? "bg-maple text-white shadow-[0_4px_0_#8a3217]" : "bg-card text-ink shadow-[var(--shadow-card)] ring-1 ring-line"
                }`}
              >
                {k === "all" ? `🌈 ${tr("kid.allCategories")}` : catLabel(k)}
              </button>
            );
          })}
        </nav>
      ) : null}
      </div>

      {household.paused ? (
        <p className="mx-8 mt-2 rounded-3xl bg-plum px-6 py-4 text-center text-2xl font-bold text-white">{tr("kid.paused")}</p>
      ) : null}

      {board.promos?.length && !household.paused ? (
        <PromoBanner promos={board.promos} currency={household.currency} locale={locale} timeZone={household.timezone} serverNow={board.now} />
      ) : null}

      {sections.fix.length > 0 ? (
        <button
          type="button"
          onClick={() => document.getElementById("needs-fixing")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="mx-6 mt-2 flex w-[calc(100%-3rem)] items-center gap-4 rounded-3xl bg-plum px-6 py-4 text-left text-white shadow-[var(--shadow-pop)] md:mx-8 md:w-[calc(100%-4rem)]"
        >
          <span className="text-5xl" aria-hidden>🛠</span>
          <span className="flex-1">
            <span className="block font-display text-3xl font-bold">{tr("kid.revisionTitle", { count: sections.fix.length })}</span>
            <span className="block text-lg font-semibold opacity-90">“{sections.fix[0]!.submission?.reviewComment}” · {sections.fix[0]!.title}</span>
          </span>
          <span className="rounded-full bg-white px-5 py-2 text-lg font-black text-plum">{tr("kid.revisionSee")}</span>
        </button>
      ) : null}

      {nudges.length > 0 ? (
        <div role="status" className="mx-6 mt-2 flex items-center gap-4 rounded-3xl bg-gold/40 px-6 py-4 text-ink shadow-[var(--shadow-card)] md:mx-8">
          <span className="flex-1 font-display text-2xl font-bold">
            {nudges.map((n) => (
              <span key={n.choreId} className="block">
                {tr("kid.claimExpired", { title: n.title })}
              </span>
            ))}
          </span>
          <button
            type="button"
            onClick={() => setNudges([])}
            className="min-h-14 rounded-full bg-card px-6 text-lg font-black text-ink shadow-[var(--shadow-card)] active:scale-95"
          >
            OK
          </button>
        </div>
      ) : null}

      {sections.inProgress.length > 0 ? (
        <SectionRow id="in-progress" title={tr("kid.section.inProgress")} count={sections.inProgress.length} tone="progress">
          <AnimatePresence mode="popLayout">
            {sections.inProgress.map((c) => (
              <motion.div key={`claim-${c.choreId}`} {...cardMotion} className="h-full">
                <ChoreCard
                  fluid
                  chore={c}
                  currency={household.currency}
                  locale={locale}
                  perLabel={perLabel(c)}
                  onPress={() => open(c, "submit")}
                  footer={claimFooter(c)}
                  badge={
                    <>
                      <span className="inline-flex items-center rounded-full bg-amber px-3 py-1 text-sm font-black tracking-wide text-white uppercase">
                        {tr("kid.claimMine")}
                      </span>
                      {promoBadge(c)}
                    </>
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SectionRow>
      ) : null}

      {available.length > 1 ? (
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft);
          }}
          className="mx-6 mt-2 flex gap-3 md:mx-8"
        >
          <input
            type="search"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSearch(e.target.value);
            }}
            placeholder={tr("kid.searchPlaceholder")}
            aria-label={tr("kid.search")}
            enterKeyHint="search"
            className="min-h-14 min-w-0 flex-1 rounded-full bg-card px-5 text-lg font-bold text-ink shadow-[var(--shadow-card)] ring-1 ring-line outline-none placeholder:text-ink-soft/60 focus:ring-2 focus:ring-amber"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setSearch("");
              }}
              className="min-h-14 shrink-0 rounded-full bg-card px-4 text-lg font-extrabold text-ink shadow-[var(--shadow-card)] ring-1 ring-line active:scale-95"
            >
              ✕
            </button>
          ) : null}
          <button type="submit" className="min-h-14 shrink-0 rounded-full bg-maple px-5 text-lg font-extrabold text-white shadow-[0_4px_0_#8a3217] active:scale-95">
            🔍 {tr("kid.search")}
          </button>
        </form>
      ) : null}


      <AnimatePresence initial={false}>
        {sections.fix.length > 0 ? (
          <SectionRow key="fix" id="needs-fixing" title={tr("kid.section.fix")} count={sections.fix.length} tone="fix">
            <AnimatePresence mode="popLayout">
              {sections.fix.map((c) => (
                <motion.div key={`fix-${c.submission?.id}`} {...cardMotion} className="h-full">
                  <ChoreCard
                    fluid
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
                        <span className="flex min-h-14 items-center justify-center rounded-2xl bg-plum text-xl font-black text-white">
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

      {routinesShown.length > 0 ? (
        <SectionRow title={tr("kid.section.routines")} count={routinesShown.length} tone="routine">
          <AnimatePresence mode="popLayout">
            {routinesShown.map((c) => (
              <motion.div key={c.choreId} {...cardMotion} className="h-full">
                <ChoreCard
                  fluid
                  routine
                  chore={c}
                  variant={newIds.has(c.choreId) ? "new" : "ready"}
                  currency={household.currency}
                  locale={locale}
                  perLabel={perLabel(c)}
                  onPress={() => open(c, "submit")}
                  footer={stepsFooter(c)}
                  badge={
                    <>
                      <span className="inline-flex items-center rounded-full bg-plum px-3 py-1 text-sm font-black tracking-wide text-white uppercase">
                        🔁 {tr("kid.routine")}
                      </span>
                      {newIds.has(c.choreId) ? (
                        <span className="inline-flex animate-pulse items-center rounded-full bg-maple px-3 py-1 text-sm font-black tracking-wide text-white uppercase">
                          ✨ {tr("kid.new")}
                        </span>
                      ) : null}
                      {promoBadge(c)}
                    </>
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SectionRow>
      ) : null}

      {newShown.length > 0 ? (
        <SectionRow title={tr("kid.section.new")} count={newShown.length} tone="new">
          <AnimatePresence mode="popLayout">
            {newShown.map((c) => (
              <motion.div key={c.choreId} {...cardMotion} className="h-full">
                <ChoreCard
                  fluid
                  chore={c}
                  variant={lockedBy(c) ? "soon" : "new"}
                  currency={household.currency}
                  locale={locale}
                  perLabel={perLabel(c)}
                  onPress={() => press(c)}
                  footer={lockedBy(c) ? lockedFooter(c) : stepsFooter(c)}
                  badge={
                    <>
                      <span className="inline-flex animate-pulse items-center rounded-full bg-maple px-3 py-1 text-sm font-black tracking-wide text-white uppercase">
                        ✨ {tr("kid.new")}
                      </span>
                      {promoBadge(c)}
                    </>
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SectionRow>
      ) : null}

      {search.trim() && routinesShown.length + newShown.length + readyShown.length + soonShown.length === 0 ? (
        <p className="px-6 py-10 text-center font-display text-3xl font-bold text-ink-soft md:px-8">
          🔍 {tr("kid.searchNone", { q: search.trim() })}
        </p>
      ) : null}
      {readyGroups.map((g) => (
        <SectionRow key={g.key} title={category === "all" ? catLabel(g.key) : tr("kid.section.ready")} count={g.cards.length}>
          <AnimatePresence mode="popLayout">
            {g.cards.map((c) => (
              <motion.div key={c.choreId} {...cardMotion} className="h-full">
                <ChoreCard
                  fluid
                  chore={c}
                  variant={lockedBy(c) ? "soon" : "ready"}
                  currency={household.currency}
                  locale={locale}
                  perLabel={perLabel(c)}
                  onPress={() => press(c)}
                  footer={lockedBy(c) ? lockedFooter(c) : stepsFooter(c)}
                  badge={lockedBy(c) ? null : promoBadge(c)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SectionRow>
      ))}

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
              <motion.div key={`w-${c.submission?.id}`} {...cardMotion} className="h-full">
                <ChoreCard
                  fluid
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

      {soonShown.length > 0 ? (
        <SectionRow title={tr("kid.section.soon")} count={soonShown.length} tone="muted">
          {soonShown.map((c) => (
            <div key={c.choreId} className="h-full">
              <ChoreCard
                fluid
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
        kidId={kid.id}
        onStepsChange={patchSteps}
        onGiveUp={pending?.mode === "resubmit" ? () => void giveUp() : undefined}
        onClaim={(q) => void claim(q)}
        onGiveBack={() => void giveBack()}
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
  const icon: Record<string, string> = { earning: "⭐", match: "🎁", bonus: "🌟", payout: "💵", adjustment: "✏️", promo: "🎉", tax: "🏛️" };
  const label = (i: KidHistoryItem) =>
    i.kind === "bonus"
      ? tr("kid.bonus", { title: (i.note ?? "").replace(/^Bonus: /, "") })
      : i.kind === "promo"
        ? tr("kid.promoRow", { name: (i.note ?? "").replace(/^Promotion: /, "") })
        : i.kind === "tax"
          ? tr("kid.taxRow")
          : i.kind === "payout"
            ? tr("kid.payoutRow")
            : i.kind === "match"
              ? tr("kid.matchRow")
              : (localizeLedgerNote(i.note, household.locale) ?? (i.kind === "adjustment" ? tr("kid.adjustmentRow") : i.kind));

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
        {board.tax?.enabled || (board.tax?.paidCents ?? 0) > 0 ? (
          <div className="mt-5 rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]" data-testid="kid-taxes">
            <p className="font-display text-2xl font-extrabold text-plum">🏛️ {tr("kid.taxesPaid", { amount: money(board.tax.paidCents) })}</p>
            <p className="mt-2 text-lg leading-snug text-ink-soft">{tr("kid.taxWhy", { percent: board.tax.percent })}</p>
          </div>
        ) : null}
        <p className="mt-6 text-xl font-bold text-ink-soft">{tr("kid.recent")}</p>
        <ul className="mt-2 divide-y divide-line">
          {(items ?? []).map((i) => (
            <li key={i.id} className="flex items-center gap-4 py-3 text-xl">
              <span aria-hidden className="text-3xl">{icon[i.kind] ?? "•"}</span>
              <span className="flex-1 font-semibold text-ink">{label(i)}</span>
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
