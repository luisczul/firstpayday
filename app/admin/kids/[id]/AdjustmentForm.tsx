"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordAdjustment } from "@/app/actions/ledger";
import { Alert, Button, Input } from "@/components/ui";
import { parseMoneyToCents } from "@/lib/money/format";

export function AdjustmentForm({ kidId }: { kidId: string }) {
  const router = useRouter();
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const cents = parseMoneyToCents(amount);
        if (!cents || cents <= 0) return setMsg({ tone: "bad", text: "Enter an amount." });
        start(async () => {
          const r = await recordAdjustment({ kidId, amountCents: sign * cents, note });
          if (!r.ok) return setMsg({ tone: "bad", text: r.message });
          setAmount("");
          setNote("");
          setMsg({ tone: "good", text: "Adjustment added" });
          router.refresh();
        });
      }}
    >
      <p className="text-sm font-bold text-ink-soft">Manual adjustment</p>
      <div className="flex gap-2">
        <div className="flex overflow-hidden rounded-xl ring-1 ring-line">
          <button type="button" onClick={() => setSign(1)} className={`min-h-11 w-11 font-black ${sign === 1 ? "bg-moss text-white" : "bg-card"}`} aria-label="Add">+</button>
          <button type="button" onClick={() => setSign(-1)} className={`min-h-11 w-11 font-black ${sign === -1 ? "bg-plum text-white" : "bg-card"}`} aria-label="Subtract">−</button>
        </div>
        <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <Input placeholder="Note (bonus, correction…)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} required />
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      <Button type="submit" size="sm" disabled={pending}>Add adjustment</Button>
    </form>
  );
}
