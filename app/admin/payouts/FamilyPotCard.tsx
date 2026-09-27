"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recordFamilyTreat } from "@/app/actions/ledger";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { amountInput, formatMoney, parseMoneyToCents } from "@/lib/money/format";
import { intlLocale, type Locale } from "@/lib/i18n";
import { taxPromoCopy } from "@/lib/i18n/taxPromoCopy";
import type { FamilyPot } from "@/lib/familyPot";
import { useParentT } from "@/lib/i18n/parent/client";

/** The family tax pot: what taxes collected, and the family treats it paid for. */
export function FamilyPotCard({
  pot,
  currency,
  locale,
  readOnly,
  taxEnabled,
}: {
  pot: FamilyPot;
  currency: string;
  locale: Locale;
  readOnly: boolean;
  taxEnabled: boolean;
}) {
  const c = taxPromoCopy(locale);
  const router = useRouter();
  const t = useParentT();
  const money = (cents: number) => formatMoney(cents, currency, locale);
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold">🏛️ {c.potTitle}</h2>
        <span className="font-display text-3xl font-bold text-moss" data-testid="family-pot">{money(pot.potCents)}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{c.potWhy}</p>
      <p className="mt-1 text-sm text-ink-soft">{c.potIdeas}</p>
      {!taxEnabled ? (
        <p className="mt-2 text-sm font-semibold">
          {c.taxOff} <Link href="/admin/settings" className="text-maple underline">{c.taxOffLink}</Link>
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-paper p-3">
          <p className="text-xs font-bold text-ink-soft">{c.potCollected}</p>
          <p className="font-display text-xl font-bold">{money(pot.collectedCents)}</p>
        </div>
        <div className="rounded-xl bg-paper p-3">
          <p className="text-xs font-bold text-ink-soft">{c.potSpent}</p>
          <p className="font-display text-xl font-bold">{money(pot.spentCents)}</p>
        </div>
      </div>

      {pot.potCents > 0 && !readOnly ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const cents = parseMoneyToCents(amount);
            if (!cents || cents <= 0) return setMsg({ tone: "bad", text: t("a.common.amountAboveZero") });
            start(async () => {
              const r = await recordFamilyTreat({ amountCents: cents, note: what });
              if (!r.ok) return setMsg({ tone: "bad", text: r.message });
              setMsg({ tone: "good", text: c.treatSaved });
              setWhat("");
              setAmount("");
              router.refresh();
            });
          }}
        >
          <p className="w-full font-bold">{c.treatTitle}</p>
          <div className="min-w-48 flex-1">
            <Field label={c.treatWhat}>
              <Input value={what} onChange={(e) => setWhat(e.target.value)} placeholder={c.treatPlaceholder} maxLength={120} required />
            </Field>
          </div>
          <div className="w-32">
            <Field label={c.treatAmount}>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={amountInput(pot.potCents, locale)} required />
            </Field>
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>{c.treatSave}</Button>
        </form>
      ) : null}
      {msg ? <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}

      {pot.spends.length ? (
        <ul className="mt-4 divide-y divide-line">
          {pot.spends.slice(0, 10).map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <span className="flex-1">
                <span className="block font-bold">🍦 {s.note}</span>
                <span className="block text-xs text-ink-soft">
                  {new Date(s.createdAt).toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </span>
              <span className="font-bold text-plum">−{money(s.amountCents)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
