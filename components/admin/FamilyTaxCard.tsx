"use client";

import { useState, useTransition } from "react";
import { setFamilyTax } from "@/app/actions/familyTax";
import { Alert, Button, Card, Field, Select } from "@/components/ui";
import { formatMoney } from "@/lib/money/format";
import { payoutSplit } from "@/lib/money/ledger";
import { taxPromoCopy } from "@/lib/i18n/taxPromoCopy";
import type { Locale } from "@/lib/i18n";

const RATES = [5, 10, 15, 20, 25, 30, 40, 50];

/** Optional family tax: Settings and the last onboarding step. */
export function FamilyTaxCard({
  initial,
  currency,
  locale,
  readOnly = false,
  title,
  autoSave = false,
}: {
  initial: { enabled: boolean; percent: number };
  currency: string;
  locale: Locale;
  readOnly?: boolean;
  title?: string;
  /** Save on every change (onboarding) instead of a Save button. */
  autoSave?: boolean;
}) {
  const c = taxPromoCopy(locale);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [percent, setPercent] = useState(initial.percent);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const money = (cents: number) => formatMoney(cents, currency, locale);
  const example = payoutSplit(1000, { enabled: true, percent });
  const save = (next: { enabled: boolean; percent: number }) =>
    start(async () => {
      const r = await setFamilyTax(next);
      setMsg(r.ok ? { tone: "good", text: c.saved } : { tone: "bad", text: r.message });
    });
  const rates = RATES.includes(percent) ? RATES : [...RATES, percent].sort((a, b) => a - b);

  return (
    <Card className="text-left">
      <h2 className="font-display text-xl font-bold">🏛️ {title ?? c.taxTitle}</h2>
      <p className="mt-1 text-sm text-ink-soft">{c.taxWhy}</p>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save({ enabled, percent });
        }}
      >
        <fieldset disabled={readOnly} className="flex flex-col gap-4">
          <label className="flex cursor-pointer items-center gap-3 font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5 accent-maple"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setMsg(null);
                if (autoSave) save({ enabled: e.target.checked, percent });
              }}
            />
            {c.taxToggle}
          </label>
          {enabled ? (
            <>
              <Field label={c.taxRate}>
                <Select
                  value={percent}
                  onChange={(e) => {
                    setPercent(Number(e.target.value));
                    setMsg(null);
                    if (autoSave) save({ enabled, percent: Number(e.target.value) });
                  }}
                  className="max-w-40"
                >
                  {rates.map((r) => (
                    <option key={r} value={r}>{locale === "fr" || locale === "es" ? `${r} %` : `${r}%`}</option>
                  ))}
                </Select>
              </Field>
              <p className="rounded-xl bg-paper px-4 py-3 text-sm font-semibold text-ink">
                {c.taxExample({ pct: percent, gross: money(example.grossCents), tax: money(example.taxCents), net: money(example.netCents) })}
              </p>
            </>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {autoSave ? null : <Button type="submit" variant="secondary" disabled={pending}>{c.save}</Button>}
            {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
          </div>
        </fieldset>
      </form>
    </Card>
  );
}
