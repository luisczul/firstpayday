"use client";

import { useState, useTransition } from "react";
import { sendSupportMessage } from "@/app/actions/support";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { useParentT } from "@/lib/i18n/parent/client";

const KINDS = [
  { k: "feature", label: "b.support.pick.feature" },
  { k: "bug", label: "b.support.pick.bug" },
  { k: "question", label: "b.support.pick.question" },
  { k: "other", label: "b.support.pick.other" },
] as const;

export function SupportForm({ email }: { email: string }) {
  const t = useParentT();
  const [kind, setKind] = useState<(typeof KINDS)[number]["k"]>("feature");
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await sendSupportMessage({
            kind,
            message,
            page: document.referrer ? new URL(document.referrer).pathname : null,
            userAgent: navigator.userAgent.slice(0, 400),
          });
          if (!r.ok) return setMsg({ tone: "bad", text: r.message });
          setMessage("");
          setMsg({ tone: "good", text: t("b.support.thanks", { email }) });
        });
      }}
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("b.support.typeOfMessage")}>
        {KINDS.map((o) => (
          <button
            key={o.k}
            type="button"
            role="radio"
            aria-checked={kind === o.k}
            onClick={() => setKind(o.k)}
            className={`min-h-11 rounded-full px-4 font-bold ${kind === o.k ? "bg-maple text-white" : "bg-card ring-1 ring-line"}`}
          >
            {t(o.label)}
          </button>
        ))}
      </div>
      <Field label={t("b.support.yourMessage")} hint={kind === "bug" ? t("b.support.bugHint") : undefined}>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} required placeholder={t("b.support.placeholder")} />
      </Field>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      <div>
        <Button type="submit" size="lg" disabled={pending || message.trim().length < 3}>
          {pending ? t("b.support.sending") : t("b.support.send")}
        </Button>
      </div>
    </form>
  );
}
