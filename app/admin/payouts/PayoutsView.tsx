"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayout } from "@/app/actions/ledger";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { Alert, Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { formatMoney, parseMoneyToCents } from "@/lib/money/format";

export interface PayoutKid {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  balanceCents: number;
  totals: { monthCents: number; yearCents: number };
  history: { id: string; amountCents: number; method: string | null; note: string | null; createdAt: string }[];
}

const METHODS = [
  { value: "cash", label: "💵 Cash" },
  { value: "bank", label: "🏦 Bank deposit" },
  { value: "savings", label: "🐷 Savings account" },
  { value: "other", label: "Other" },
] as const;

export function PayoutsView({
  kids,
  initialKidId,
  currency,
  locale,
  readOnly,
}: {
  kids: PayoutKid[];
  initialKidId: string | null;
  currency: string;
  locale: "en" | "fr";
  readOnly: boolean;
}) {
  const router = useRouter();
  const [kidId, setKidId] = useState(initialKidId);
  const kid = kids.find((k) => k.id === kidId) ?? kids[0];
  const money = (c: number) => formatMoney(c, currency, locale);
  const [amount, setAmount] = useState(kid ? (Math.max(0, kid.balanceCents) / 100).toFixed(2) : "");
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("cash");
  const [note, setNote] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!kid) return <EmptyState emoji="👧" title="Add a kid first" />;

  const choose = (k: PayoutKid) => {
    setKidId(k.id);
    setAmount((Math.max(0, k.balanceCents) / 100).toFixed(2));
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
              if (!cents || cents <= 0) return setMsg({ tone: "bad", text: "Enter an amount above zero." });
              start(async () => {
                const r = await recordPayout({ kidId: kid.id, amountCents: cents, method, note, allowNegative });
                if (!r.ok) return setMsg({ tone: "bad", text: r.message });
                setMsg({ tone: "good", text: `Paid ${money(cents)} to ${kid.name}` });
                setNote("");
                router.refresh();
              });
            }}
          >
            <p className="text-ink-soft">
              {kid.name}&apos;s balance: <b className="font-display text-2xl text-moss">{money(kid.balanceCents)}</b>
            </p>
            <fieldset disabled={readOnly} className="flex flex-col gap-4">
              <Field label="Amount">
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-2xl font-bold" />
              </Field>
              <Field label="How?">
                <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Note (optional)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
              </Field>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} className="h-5 w-5 accent-maple" />
                Allow negative balance
              </label>
              {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
              <Button type="submit" size="lg" disabled={pending}>Record payout</Button>
            </fieldset>
          </form>
        </Card>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-paper p-3">
            <p className="text-xs font-bold text-ink-soft">This month</p>
            <p className="font-display text-2xl font-bold">{money(kid.totals.monthCents)}</p>
          </div>
          <div className="rounded-xl bg-paper p-3">
            <p className="text-xs font-bold text-ink-soft">This year</p>
            <p className="font-display text-2xl font-bold">{money(kid.totals.yearCents)}</p>
          </div>
        </div>
        <h2 className="mb-2 font-display text-xl font-bold">Payout history</h2>
        {kid.history.length ? (
          <ul className="divide-y divide-line">
            {kid.history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{METHODS.find((m) => m.value === h.method)?.label ?? "Payout"}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {new Date(h.createdAt).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric", year: "numeric" })}
                    {h.note ? ` · ${h.note}` : ""}
                  </span>
                </span>
                <span className="font-bold text-plum">{money(h.amountCents)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">No payouts yet.</p>
        )}
      </Card>
    </div>
  );
}
