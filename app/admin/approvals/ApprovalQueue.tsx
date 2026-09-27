"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { dateFnsLocale } from "@/lib/i18n/dateFns";
import { approveAllForKid, approveSubmission, rejectSubmission, sendBackSubmission } from "@/app/actions/approvals";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { Alert, Button, EmptyState, Input } from "@/components/ui";
import { amountInput, formatMoney, formatPrice, parseMoneyToCents } from "@/lib/money/format";
import { matchFor } from "@/lib/money/ledger";
import { bestPromo, type Promotion } from "@/lib/money/promotions";
import { taxPromoCopy } from "@/lib/i18n/taxPromoCopy";
import { type Locale } from "@/lib/i18n";
import { groupSubtasks, type Subtask } from "@/lib/schedule/checklist";
import { useParentT } from "@/lib/i18n/parent/client";
import { PriceInput } from "@/components/admin/TemplatePicker";

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
  /** The chore's price today (may differ if the parent fixed it after the kid submitted). */
  chorePriceCents?: number;
  submittedAt: string;
  resubmitted: boolean;
  previousComment: string | null;
  /** Checklist chore: every step was ticked before the kid could send it. */
  subtasks?: Subtask[];
  /** Promotions live when this was submitted; the best one is added on approval. */
  promos: Promotion[];
}

const STEPS_DONE: Record<Locale, (n: number) => string> = {
  en: (n) => `All ${n} steps done`,
  fr: (n) => `Les ${n} étapes sont faites`,
  es: (n) => `Los ${n} pasos listos`,
  pt: (n) => `Os ${n} passos feitos`,
};

/** Quick send-back comments go to the kid, so they follow the household language. */
export const QUICK: Record<Locale, string[]> = {
  en: ["Missed a spot", "Not finished", "Please redo carefully"],
  fr: ["Il manque un coin", "Pas terminé", "Refais-le avec soin"],
  es: ["Faltó un rincón", "No está terminado", "Vuelve a hacerlo con cuidado"],
  pt: ["Faltou um cantinho", "Ficou incompleto", "Refaça com cuidado"],
};

const TIP_COPY: Record<Locale, { group: string; label: string; other: string; amount: string; none: string; range: (max: string) => string; approve: string; plus: (p: string) => string }> = {
  en: { group: "Add a tip", label: "Add a tip:", other: "Other…", amount: "Tip amount", none: "No tip", range: (m) => `Between 0 and ${m}`, approve: "✓ Approve", plus: (p) => ` + ${p} tip` },
  fr: { group: "Ajouter un bonus", label: "Bonus :", other: "Autre…", amount: "Montant du bonus", none: "Aucun bonus", range: (m) => `Entre 0 et ${m}`, approve: "✓ Approuver", plus: (p) => ` + ${p} de bonus` },
  es: { group: "Agregar un bono", label: "Bono:", other: "Otro…", amount: "Monto del bono", none: "Sin bono", range: (m) => `Entre 0 y ${m}`, approve: "✓ Aprobar", plus: (p) => ` + ${p} de bono` },
  pt: { group: "Adicionar um bônus", label: "Bônus:", other: "Outro…", amount: "Valor do bônus", none: "Sem bônus", range: (m) => `Entre 0 e ${m}`, approve: "✓ Aprovar", plus: (p) => ` + ${p} de bônus` },
};
const TIPS = [50, 100, 200];
const MAX_TIP = 10_000;

export function ApprovalQueue({
  items,
  currency,
  locale,
  readOnly,
  matchPercent,
}: {
  items: QueueItem[];
  currency: string;
  locale: Locale;
  readOnly: boolean;
  matchPercent: number;
}) {
  const t = useParentT();
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
      <EmptyState emoji="🎉" title={t("a.appr.emptyTitle")}>
        {t("a.appr.emptyBody")}
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
  locale: Locale;
  readOnly: boolean;
  matchPercent: number;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onError: (m: string | null) => void;
}) {
  const t = useParentT();
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
                {t("a.appr.confirmAll", { n: items.length, amount: formatMoney(total, currency, locale) })}
              </span>
              <Button
                variant="success"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    items.forEach((i) => onHide(i.id));
                    const r = await approveAllForKid(kid.kidId);
                    items.forEach((i) => onUnhide(i.id));
                    if (!r.ok) onError(r.message);
                    setConfirmAll(false);
                  })
                }
              >
                {t("a.appr.yesAll")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmAll(false)}>{t("a.common.cancel")}</Button>
            </span>
          ) : (
            <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setConfirmAll(true)}>
              {t("a.appr.approveAll", { n: items.length })}
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
  locale: Locale;
  readOnly: boolean;
  matchPercent: number;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onError: (m: string | null) => void;
}) {
  const t = useParentT();
  const [qty, setQty] = useState(item.quantity);
  const [unitPrice, setUnitPrice] = useState(item.unitPriceCents);
  const [editingPrice, setEditingPrice] = useState(false);
  const [keepPrice, setKeepPrice] = useState(false);
  const chorePrice = item.chorePriceCents ?? item.unitPriceCents;
  const [mode, setMode] = useState<"idle" | "sendBack" | "reject">("idle");
  const [comment, setComment] = useState("");
  const [menu, setMenu] = useState(false);
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const money = (c: number) => formatMoney(c, currency, locale);
  const price = (c: number) => formatPrice(c, currency, locale);
  const amount = qty * unitPrice;
  const priceChanged = unitPrice !== item.unitPriceCents;
  const tc = TIP_COPY[locale] ?? TIP_COPY.en;
  const parsedCustom = customTip === null || customTip.trim() === "" ? 0 : parseMoneyToCents(customTip);
  const customInvalid = customTip !== null && (parsedCustom === null || parsedCustom < 0 || parsedCustom > MAX_TIP);
  const bonus = customTip !== null ? (customInvalid ? 0 : (parsedCustom ?? 0)) : tip;
  const match = matchFor(amount, matchPercent);
  const promo = bestPromo(item.promos, new Date(item.submittedAt), amount);

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      onError(null);
      onHide(item.id);
      const r = await fn();
      // The action's revalidation already removed it from the list; stop hiding
      // so the same submission can reappear later (e.g. after "Fixed it!").
      onUnhide(item.id);
      if (!r.ok) onError(r.message ?? t("a.common.error"));
    });

  return (
    <li className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-4xl" aria-hidden>{item.emoji ?? "⭐"}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold leading-tight text-ink">
            {item.title}
            {item.resubmitted ? <span className="ml-2 rounded-full bg-plum/10 px-2 py-0.5 align-middle font-sans text-xs font-black text-plum">{t("a.appr.fixed")}</span> : null}
          </p>
          <p className="text-sm text-ink-soft">
            {formatDistanceToNow(new Date(item.submittedAt), { addSuffix: true, locale: dateFnsLocale(locale) })}
            {item.previousComment ? ` · ${t("a.appr.youSaid", { comment: item.previousComment })}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {item.maxQuantity > 1 ? (
            <span className="flex items-center gap-1 rounded-xl bg-paper px-1 py-1">
              <button type="button" className="h-9 w-9 rounded-lg text-xl font-black disabled:opacity-30" disabled={qty <= 1 || readOnly} onClick={() => setQty(qty - 1)} aria-label={t("a.appr.less")}>−</button>
              <span className="w-6 text-center font-black">{qty}</span>
              <button type="button" className="h-9 w-9 rounded-lg text-xl font-black disabled:opacity-30" disabled={qty >= item.maxQuantity || readOnly} onClick={() => setQty(qty + 1)} aria-label={t("a.appr.more")}>+</button>
            </span>
          ) : null}
          <span className="text-right">
            <span className="block text-xs font-bold text-ink-soft">
              {qty} × {priceChanged ? <s className="mr-1 opacity-60">{money(item.unitPriceCents)}</s> : null}
              {money(unitPrice)}
              {item.unitLabel ? ` / ${item.unitLabel}` : ""}
              {!readOnly ? (
                <button type="button" className="ml-1.5 underline decoration-dotted" onClick={() => setEditingPrice((v) => !v)} aria-label={t("c.appr.editPrice")}>
                  ✏️
                </button>
              ) : null}
            </span>
            <span className="block font-display text-2xl font-bold text-moss">{money(amount)}</span>
            {match > 0 ? <span className="block text-xs font-bold text-amber">{t("a.appr.match", { amount: money(match) })}</span> : null}
            {promo ? (
              <span className="block text-xs font-bold text-maple" data-testid="promo-bonus">
                🎉 {taxPromoCopy(locale).promoOnApproval(money(promo.bonusCents), promo.promo.name)}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      {editingPrice || (!readOnly && chorePrice !== item.unitPriceCents && !priceChanged) ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-paper px-4 py-3" data-testid="price-editor">
          {chorePrice !== item.unitPriceCents && unitPrice !== chorePrice ? (
            <Button size="sm" variant="secondary" onClick={() => { setUnitPrice(chorePrice); setEditingPrice(true); }}>
              {t("c.appr.useCurrent", { price: money(chorePrice) })}
            </Button>
          ) : null}
          {editingPrice ? (
            <>
              <span className="text-sm font-bold text-ink">{t("c.appr.priceLabel")}</span>
              <PriceInput key={unitPrice} cents={unitPrice} currency={currency} locale={locale} onChange={setUnitPrice} />
              {priceChanged ? (
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" className="h-4 w-4 accent-maple" checked={keepPrice} onChange={(e) => setKeepPrice(e.target.checked)} />
                  {t("c.appr.keepPrice", { title: item.title })}
                </label>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {item.subtasks?.length ? (
        <div className="mt-3 rounded-xl bg-moss/10 px-4 py-3" data-testid="approval-steps">
          <p className="text-sm font-black text-moss">☑ {(STEPS_DONE[locale] ?? STEPS_DONE.en)(item.subtasks.length)}</p>
          {groupSubtasks(item.subtasks).map((g, gi) => (
            <div key={gi} className="mt-1">
              {g.section ? <p className="text-xs font-black text-ink-soft">{g.section}</p> : null}
              <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-ink">
                {g.items.map((s) => (
                  <li key={s.id}>✓ {s.title}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {!readOnly && mode === "idle" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={tc.group}>
          <span className="text-sm font-bold text-ink-soft">{tc.label}</span>
          {TIPS.map((c) => {
            const on = customTip === null && tip === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setCustomTip(null);
                  setTip(on ? 0 : c);
                }}
                className={`min-h-10 rounded-full px-4 text-sm font-bold ${on ? "bg-amber text-white" : "bg-paper text-ink ring-1 ring-line"}`}
              >
                +{price(c)}
              </button>
            );
          })}
          {customTip === null ? (
            <button
              type="button"
              onClick={() => {
                setTip(0);
                setCustomTip("");
              }}
              className="min-h-10 rounded-full bg-paper px-4 text-sm font-bold text-ink ring-1 ring-line"
            >
              {tc.other}
            </button>
          ) : (
            <span className="flex items-center gap-1">
              <Input
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                inputMode="decimal"
                placeholder={amountInput(0, locale)}
                aria-label={tc.amount}
                aria-invalid={customInvalid}
                className="min-h-10! w-24!"
                autoFocus
              />
              <button
                type="button"
                aria-label={tc.none}
                onClick={() => setCustomTip(null)}
                className="h-10 w-10 rounded-full text-lg font-black text-ink-soft"
              >
                ×
              </button>
            </span>
          )}
          {customInvalid ? (
            <span className="w-full text-xs font-bold text-danger">
              {tc.range(price(MAX_TIP))}
            </span>
          ) : null}
        </div>
      ) : null}

      {!readOnly && mode === "idle" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="success"
            size="lg"
            className="min-w-36 flex-1 sm:flex-none"
            disabled={pending || customInvalid}
            onClick={() =>
              act(() =>
                approveSubmission(
                  item.id,
                  qty,
                  undefined,
                  bonus > 0 ? bonus : undefined,
                  priceChanged ? { unitPriceCents: unitPrice, updateChore: keepPrice } : undefined,
                ),
              )
            }
          >
            {tc.approve}
            {bonus > 0 ? tc.plus(price(bonus)) : ""}
          </Button>
          <Button variant="secondary" size="lg" disabled={pending} onClick={() => setMode("sendBack")}>
            {t("a.appr.sendBackOpen")}
          </Button>
          <div className="relative ml-auto">
            <Button variant="ghost" size="lg" aria-label={t("a.appr.more")} onClick={() => setMenu((m) => !m)}>⋯</Button>
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
                  {t("a.appr.rejectOpen")}
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
            {mode === "sendBack" ? t("a.appr.sendBackQ") : t("a.appr.rejectQ")}
          </p>
          {mode === "sendBack" ? (
            <div className="flex flex-wrap gap-2">
              {(QUICK[locale] ?? QUICK.en).map((q) => (
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
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("a.appr.typeMessage")} maxLength={300} autoFocus />
          <div className="flex gap-2">
            <Button type="submit" variant={mode === "reject" ? "danger" : "primary"} disabled={!comment.trim() || pending}>
              {mode === "sendBack" ? t("a.appr.sendBack") : t("a.appr.reject")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setMode("idle"); setComment(""); }}>{t("a.common.cancel")}</Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
