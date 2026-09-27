"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayout } from "@/app/actions/ledger";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { Alert, Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { amountInput, formatMoney, parseMoneyToCents } from "@/lib/money/format";
import { intlLocale, type Locale } from "@/lib/i18n";
import { payoutSplit } from "@/lib/money/ledger";
import { taxPromoCopy } from "@/lib/i18n/taxPromoCopy";
import { useParentT } from "@/lib/i18n/parent/client";
import type { ParentKey } from "@/lib/i18n/parent";

export interface PayoutKid {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  balanceCents: number;
  totals: { monthCents: number; yearCents: number };
  history: { id: string; amountCents: number; taxCents: number; method: string | null; note: string | null; createdAt: string }[];
  /** Family tax withheld from this kid's payouts so far. */
  taxesPaidCents: number;
}

const METHODS = [
  { value: "cash", label: "a.pay.method.cash" },
  { value: "bank", label: "a.pay.method.bank" },
  { value: "savings", label: "a.pay.method.savings" },
  { value: "other", label: "a.pay.method.other" },
] as const satisfies readonly { value: string; label: ParentKey }[];

export function PayoutsView({
  kids,
  initialKidId,
  currency,
  locale,
  readOnly,
  tax,
}: {
  kids: PayoutKid[];
  initialKidId: string | null;
  currency: string;
  locale: Locale;
  readOnly: boolean;
  tax: { enabled: boolean; percent: number };
}) {
  const tc = taxPromoCopy(locale);
  const t = useParentT();
  const router = useRouter();
  const [kidId, setKidId] = useState(initialKidId);
  const kid = kids.find((k) => k.id === kidId) ?? kids[0];
  const money = (c: number) => formatMoney(c, currency, locale);
  const [amount, setAmount] = useState(kid ? amountInput(Math.max(0, kid.balanceCents), locale) : "");
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("cash");
  const [note, setNote] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!kid) return <EmptyState emoji="👧" title={t("a.pay.addKidFirst")} />;
  const typed = parseMoneyToCents(amount);
  const split = typed && typed > 0 ? payoutSplit(typed, tax) : null;

  const choose = (k: PayoutKid) => {
    setKidId(k.id);
    setAmount(amountInput(Math.max(0, k.balanceCents), locale));
    setMsg(null);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          {kids.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => choose(k)}
              className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-2 font-bold ${k.id === kid.id ? "bg-card ring-2 ring-maple" : "bg-card/60 ring-1 ring-line"}`}
            >
              <KidAvatar name={k.name} color={k.color} avatarUrl={k.avatarUrl} size={40} ring={false} />
              <span className="text-left">
                <span className="block">{k.name}</span>
                <span className="block text-sm text-moss">{money(k.balanceCents)}</span>
              </span>
            </button>
          ))}
        </div>

        <Card>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const cents = parseMoneyToCents(amount);
              if (!cents || cents <= 0) return setMsg({ tone: "bad", text: t("a.common.amountAboveZero") });
              start(async () => {
                const r = await recordPayout({ kidId: kid.id, amountCents: cents, method, note, allowNegative });
                if (!r.ok) return setMsg({ tone: "bad", text: r.message });
                const net = r.data?.netCents ?? cents;
                const withheld = r.data?.taxCents ?? 0;
                setMsg({ tone: "good", text: tc.paid(money(net), kid.name, withheld > 0 ? money(withheld) : "") });
                setNote("");
                router.refresh();
              });
            }}
          >
            <p className="text-ink-soft">
              {t("a.pay.balanceOf", { name: kid.name })} <b className="font-display text-2xl text-moss">{money(kid.balanceCents)}</b>
            </p>
            <fieldset disabled={readOnly} className="flex flex-col gap-4">
              <Field label={t("a.pay.amount")}>
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-2xl font-bold" />
              </Field>
              <Field label={t("a.pay.how")}>
                <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{t(m.label)}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("a.pay.noteOptional")}>
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
              </Field>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} className="h-5 w-5 accent-maple" />
                {t("a.pay.allowNegative")}
              </label>
              {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
              {tax.enabled && split ? (
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-xl bg-paper px-4 py-3" aria-label={t("a.pay.breakdown")}>
                  <dt className="text-ink-soft">{tc.gross}</dt>
                  <dd className="text-right font-bold">{money(split.grossCents)}</dd>
                  <dt className="text-ink-soft">{tc.taxLine(tax.percent)}</dt>
                  <dd className="text-right font-bold text-plum">−{money(split.taxCents)}</dd>
                  <dt className="border-t border-line pt-1 font-bold">{tc.net}</dt>
                  <dd className="border-t border-line pt-1 text-right font-display text-2xl font-bold text-moss">{money(split.netCents)}</dd>
                </dl>
              ) : null}
              <Button type="submit" size="lg" disabled={pending}>
                {tax.enabled && split ? tc.payNet(money(split.netCents), kid.name) : t("a.pay.record")}
              </Button>
            </fieldset>
          </form>
        </Card>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-paper p-3">
            <p className="text-xs font-bold text-ink-soft">{t("a.pay.thisMonth")}</p>
            <p className="font-display text-2xl font-bold">{money(kid.totals.monthCents)}</p>
          </div>
          <div className="rounded-xl bg-paper p-3">
            <p className="text-xs font-bold text-ink-soft">{t("a.pay.thisYear")}</p>
            <p className="font-display text-2xl font-bold">{money(kid.totals.yearCents)}</p>
          </div>
          {kid.taxesPaidCents > 0 ? (
            <div className="col-span-2 rounded-xl bg-paper p-3">
              <p className="text-xs font-bold text-ink-soft">{tc.taxesPaidBy}</p>
              <p className="font-display text-2xl font-bold text-plum">{money(kid.taxesPaidCents)}</p>
            </div>
          ) : null}
        </div>
        <h2 className="mb-2 font-display text-xl font-bold">{t("a.pay.history")}</h2>
        {kid.history.length ? (
          <ul className="divide-y divide-line">
            {kid.history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{t(METHODS.find((m) => m.value === h.method)?.label ?? "a.pay.payout")}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {new Date(h.createdAt).toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric", year: "numeric" })}
                    {h.note ? ` · ${h.note}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold text-plum">{money(h.amountCents)}</span>
                  {h.taxCents > 0 ? <span className="block text-xs text-ink-soft">+ {money(h.taxCents)} {tc.taxTitle.toLowerCase()}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">{t("a.pay.none")}</p>
        )}
      </Card>
    </div>
  );
}
