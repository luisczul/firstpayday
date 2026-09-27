"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordAdjustment } from "@/app/actions/ledger";
import { Alert, Button, Input } from "@/components/ui";
import { amountInput, parseMoneyToCents } from "@/lib/money/format";
import { useParentLocale, useParentT } from "@/lib/i18n/parent/client";

/** Quick picks for a custom reward; "Other" takes any emoji. */
const ICONS = ["⭐", "🤝", "💪", "🧺", "🛒", "🍳", "🐶", "🌱", "📚", "🎁"] as const;

/**
 * Add to a kid's balance for something that isn't in the chore list: an icon, a name and what it
 * was. The minus side is for corrections. Kids see the icon and name in their money list.
 */
export function AdjustmentForm({ kidId }: { kidId: string }) {
  const router = useRouter();
  const t = useParentT();
  const locale = useParentLocale();
  const [sign, setSign] = useState<1 | -1>(1);
  const [icon, setIcon] = useState<string>(ICONS[0]);
  const [other, setOther] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const chosen = other.trim() || icon;

  return (
    <form
      className="flex flex-col gap-3"
      id="reward"
      data-testid="reward-form"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        const cents = parseMoneyToCents(amount);
        if (!cents || cents <= 0) return setMsg({ tone: "bad", text: t("a.common.enterAmount") });
        if (!title.trim()) return setMsg({ tone: "bad", text: t("a.err.rewardName") });
        start(async () => {
          const r = await recordAdjustment({ kidId, amountCents: sign * cents, icon: chosen, title, note });
          if (!r.ok) return setMsg({ tone: "bad", text: r.message });
          setTitle("");
          setAmount("");
          setNote("");
          setOther("");
          setIcon(ICONS[0]);
          setMsg({ tone: "good", text: t(sign === 1 ? "a.adj.done" : "a.adj.doneTake") });
          router.refresh();
        });
      }}
    >
      <div>
        <h2 className="font-display text-xl font-bold">{t("a.adj.title")}</h2>
        <p className="text-sm text-ink-soft">{t("a.adj.hint")}</p>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-bold text-ink-soft">{t("a.adj.icon")}</legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={!other.trim() && icon === i}
              onClick={() => {
                setIcon(i);
                setOther("");
              }}
              className={`grid size-11 place-items-center rounded-xl text-2xl ring-1 ${!other.trim() && icon === i ? "bg-gold/30 ring-2 ring-maple" : "bg-card ring-line"}`}
            >
              {i}
            </button>
          ))}
          <Input
            aria-label={t("a.adj.iconOther")}
            placeholder={t("a.adj.iconOther")}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={8}
            className="!w-24 text-center text-xl"
          />
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink-soft">{t("a.adj.name")}</span>
        <Input placeholder={t("a.adj.namePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
      </label>

      <div className="flex gap-2">
        <div className="flex shrink-0 overflow-hidden rounded-xl ring-1 ring-line">
          <button type="button" onClick={() => setSign(1)} className={`min-h-11 w-11 font-black ${sign === 1 ? "bg-moss text-white" : "bg-card"}`} aria-label={t("a.adj.add")} aria-pressed={sign === 1}>+</button>
          <button type="button" onClick={() => setSign(-1)} className={`min-h-11 w-11 font-black ${sign === -1 ? "bg-plum text-white" : "bg-card"}`} aria-label={t("a.adj.subtract")} aria-pressed={sign === -1}>−</button>
        </div>
        <Input aria-label={t("a.pay.amount")} inputMode="decimal" placeholder={amountInput(0, locale)} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink-soft">{t("a.adj.note")}</span>
        <Input placeholder={t("a.adj.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </label>

      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {chosen} {t(sign === 1 ? "a.adj.submit" : "a.adj.submitTake")}
      </Button>
    </form>
  );
}
