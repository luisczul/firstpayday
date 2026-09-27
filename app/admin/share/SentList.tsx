"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resendShareInvite } from "@/app/actions/share";
import { Alert, Badge, Button } from "@/components/ui";
import { intlLocale } from "@/lib/i18n";
import { useParentLocale, useParentT } from "@/lib/i18n/parent/client";

type Row = { id: string; email: string; sent_at: string; last_sent_at: string; send_count: number; joined_at: string | null };

export function SentList({ rows }: { rows: Row[] }) {
  const t = useParentT();
  const locale = useParentLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [, start] = useTransition();
  const date = (s: string) => new Date(s).toLocaleDateString(intlLocale(locale), { dateStyle: "medium" });

  if (rows.length === 0) return <p className="rounded-2xl bg-card p-4 text-ink-soft ring-1 ring-line">{t("c.share.listEmpty")}</p>;

  return (
    <>
      {msg ? (
        <div className="mb-3">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      ) : null}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-line" data-testid="share-row">
            <div className="min-w-0 flex-1">
              <p className="font-bold break-all text-ink">{r.email}</p>
              <p className="text-sm text-ink-soft">
                {t("c.share.sentOn", { date: date(r.last_sent_at) })}
                {r.send_count > 1 ? ` · ${t("c.share.timesSent", { count: r.send_count })}` : ""}
              </p>
            </div>
            <Badge tone={r.joined_at ? "good" : "neutral"}>{r.joined_at ? t("c.share.status.joined") : t("c.share.status.sent")}</Badge>
            {r.joined_at ? null : (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy === r.id}
                aria-label={`${t("c.share.resend")} ${r.email}`}
                onClick={() => {
                  setBusy(r.id);
                  setMsg(null);
                  start(async () => {
                    const res = await resendShareInvite(r.id);
                    setBusy(null);
                    if (!res.ok) return setMsg({ tone: "bad", text: res.message });
                    setMsg({ tone: "good", text: t("c.share.resent", { email: r.email }) });
                    router.refresh();
                  });
                }}
              >
                {t("c.share.resend")}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
