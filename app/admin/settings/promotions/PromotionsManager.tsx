"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePromotion, endPromotion, savePromotion } from "@/app/actions/promotions";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { amountInput, formatMoney, formatPrice, parseMoneyToCents } from "@/lib/money/format";
import { promoStatus, type Promotion } from "@/lib/money/promotions";
import { intlLocale, type Locale } from "@/lib/i18n";
import { taxPromoCopy } from "@/lib/i18n/taxPromoCopy";
import { parentT } from "@/lib/i18n/parent";

type LocalPromotion = Promotion & { startDate: string; startTime: string; endDate: string; endTime: string };
type Draft = {
  id?: string;
  name: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  bonusKind: "flat" | "percent";
  amount: string;
  percent: string;
};

export function PromotionsManager({
  promotions,
  defaults,
  timezone,
  currency,
  locale,
  readOnly,
  now,
}: {
  promotions: LocalPromotion[];
  defaults: { startDate: string; startTime: string; endDate: string; endTime: string };
  timezone: string;
  currency: string;
  locale: Locale;
  readOnly: boolean;
  now: string;
}) {
  const c = taxPromoCopy(locale);
  const t = parentT(locale);
  const router = useRouter();
  const blank: Draft = { name: "", ...defaults, bonusKind: "flat", amount: amountInput(100, locale), percent: "20" };
  const [draft, setDraft] = useState<Draft>(blank);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const at = new Date(now);
  const bonusLabel = (p: Promotion) =>
    p.bonusKind === "flat" ? `+${formatPrice(p.bonusValue, currency, locale)}` : `+${p.bonusValue}%`;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(intlLocale(locale), { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const live = promotions.filter((p) => promoStatus(p, at) !== "ended");
  const past = promotions.filter((p) => promoStatus(p, at) === "ended").reverse();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (ok ? { tone: "good", text: ok } : null) : { tone: "bad", text: r.message ?? t("b.common.somethingWrong") });
      if (r.ok) router.refresh();
    });

  const row = (p: LocalPromotion) => {
    const status = promoStatus(p, at);
    return (
      <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-bold">
            🎉 {p.name}
            <Badge tone={status === "active" ? "good" : status === "scheduled" ? "warn" : "neutral"}>{c.promoStatus[status]}</Badge>
          </span>
          <span className="block text-sm text-ink-soft">
            {c.promoPerChore(bonusLabel(p))} · {when(p.startsAt)} → {when(p.endsAt)}
          </span>
        </span>
        {!readOnly && status !== "ended" ? (
          <span className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDraft({
                  id: p.id,
                  name: p.name,
                  startDate: p.startDate,
                  startTime: p.startTime,
                  endDate: p.endDate,
                  endTime: p.endTime,
                  bonusKind: p.bonusKind,
                  amount: p.bonusKind === "flat" ? amountInput(p.bonusValue, locale) : amountInput(100, locale),
                  percent: p.bonusKind === "percent" ? String(p.bonusValue) : "20",
                })
              }
            >
              {c.promoEdit}
            </Button>
            {status === "active" ? (
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => endPromotion(p.id))}>
                {c.promoEndNow}
              </Button>
            ) : (
              <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => deletePromotion(p.id))}>
                {c.promoDelete}
              </Button>
            )}
          </span>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="font-display text-xl font-bold">🎉 {c.promoTitle}</h2>
        <p className="mt-1 text-sm text-ink-soft">{c.promoIntro}</p>
        <p className="mt-1 text-xs text-ink-soft">{c.promoTz(timezone.replaceAll("_", " "))}</p>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const bonusValue = draft.bonusKind === "flat" ? parseMoneyToCents(draft.amount) : Number(draft.percent);
            if (!bonusValue || bonusValue <= 0 || !Number.isInteger(bonusValue)) {
              return setMsg({ tone: "bad", text: draft.bonusKind === "flat" ? t("b.promo.amountAboveZero") : t("b.promo.percentAboveZero") });
            }
            if (`${draft.endDate}T${draft.endTime}` <= `${draft.startDate}T${draft.startTime}`) {
              return setMsg({ tone: "bad", text: c.promoEndBeforeStart });
            }
            run(async () => {
              const r = await savePromotion({
                id: draft.id,
                name: draft.name,
                startDate: draft.startDate,
                startTime: draft.startTime,
                endDate: draft.endDate,
                endTime: draft.endTime,
                bonusKind: draft.bonusKind,
                bonusValue,
              });
              if (r.ok) setDraft(blank);
              return r;
            }, c.saved);
          }}
        >
          <fieldset disabled={readOnly} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label={c.promoName}>
                <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder={c.promoNamePlaceholder} maxLength={60} required />
              </Field>
            </div>
            <div className="flex gap-2">
              <Field label={`${c.promoStarts} (${c.promoDate})`}>
                <Input type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} required />
              </Field>
              <Field label={`${c.promoStarts} (${c.promoTime})`}>
                <Input type="time" value={draft.startTime} onChange={(e) => set("startTime", e.target.value)} required />
              </Field>
            </div>
            <div className="flex gap-2">
              <Field label={`${c.promoEnds} (${c.promoDate})`}>
                <Input type="date" value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} required />
              </Field>
              <Field label={`${c.promoEnds} (${c.promoTime})`}>
                <Input type="time" value={draft.endTime} onChange={(e) => set("endTime", e.target.value)} required />
              </Field>
            </div>
            <Field label={c.promoBonus}>
              <Select value={draft.bonusKind} onChange={(e) => set("bonusKind", e.target.value as Draft["bonusKind"])}>
                <option value="flat">{c.promoFlat}</option>
                <option value="percent">{c.promoPercent}</option>
              </Select>
            </Field>
            {draft.bonusKind === "flat" ? (
              <Field label={c.promoAmount} hint={draft.amount ? c.promoPerChore(`+${formatMoney(parseMoneyToCents(draft.amount) ?? 0, currency, locale)}`) : undefined}>
                <Input inputMode="decimal" value={draft.amount} onChange={(e) => set("amount", e.target.value)} required />
              </Field>
            ) : (
              <Field label={c.promoPercentValue} hint={c.promoPerChore(`+${draft.percent || 0}%`)}>
                <Input type="number" min={1} max={200} step={1} value={draft.percent} onChange={(e) => set("percent", e.target.value)} required />
              </Field>
            )}
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button type="submit" disabled={pending}>{draft.id ? c.promoSaveChanges : c.promoCreate}</Button>
              {draft.id ? (
                <Button type="button" variant="ghost" onClick={() => setDraft(blank)}>{c.promoCancel}</Button>
              ) : null}
              {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
            </div>
          </fieldset>
        </form>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">{c.promoUpcoming}</h2>
        {live.length ? <ul className="divide-y divide-line">{live.map(row)}</ul> : <p className="mt-2 text-ink-soft">{c.promoNone}</p>}
        {past.length ? (
          <>
            <h2 className="mt-6 font-display text-lg font-bold">{c.promoPast}</h2>
            <ul className="divide-y divide-line">{past.map(row)}</ul>
          </>
        ) : null}
      </Card>
    </div>
  );
}
