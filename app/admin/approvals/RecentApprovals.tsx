"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { dateFnsLocale } from "@/lib/i18n/dateFns";
import { reopenSubmission } from "@/app/actions/approvals";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { Alert, Button, Input } from "@/components/ui";
import { formatMoney } from "@/lib/money/format";
import { type Locale } from "@/lib/i18n";
import { useParentT } from "@/lib/i18n/parent/client";
import { QUICK } from "./ApprovalQueue";

export interface ApprovedItem {
  id: string;
  kidName: string;
  kidColor: string;
  kidAvatar: string | null;
  title: string;
  emoji: string | null;
  amountCents: number;
  reviewedAt: string;
}

/** Approved in the last 14 days, with "Undo…" for when a double-check fails. */
export function RecentApprovals({
  items,
  currency,
  locale,
  readOnly,
}: {
  items: ApprovedItem[];
  currency: string;
  locale: Locale;
  readOnly: boolean;
}) {
  const t = useParentT();
  // Kept here, not in the row: the row leaves the list once it's undone.
  const [done, setDone] = useState<string | null>(null);
  if (items.length === 0 && !done) return null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold text-ink">{t("a.recent.title")}</h2>
      <p className="mb-3 text-sm text-ink-soft">
        {t("a.recent.intro")}
      </p>
      {done ? <div className="mb-3"><Alert tone="good">{done}</Alert></div> : null}
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <Row key={i.id} item={i} currency={currency} locale={locale} readOnly={readOnly} onDone={setDone} />
        ))}
      </ul>
    </section>
  );
}

function Row({
  item,
  currency,
  locale,
  readOnly,
  onDone,
}: {
  item: ApprovedItem;
  currency: string;
  locale: Locale;
  readOnly: boolean;
  onDone: (message: string) => void;
}) {
  const t = useParentT();
  const [mode, setMode] = useState<"idle" | "choose" | "revision" | "reverse">("idle");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const money = formatMoney(item.amountCents, currency, locale);

  return (
    <li className="rounded-2xl bg-card p-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-3">
        <KidAvatar name={item.kidName} color={item.kidColor} avatarUrl={item.kidAvatar} size={36} ring={false} />
        <span className="text-2xl" aria-hidden>{item.emoji ?? "⭐"}</span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block font-bold break-words">{item.title}</span>
          <span className="block text-xs text-ink-soft">
            {item.kidName} · {t("a.recent.approved", { when: formatDistanceToNow(new Date(item.reviewedAt), { addSuffix: true, locale: dateFnsLocale(locale) }) })}
          </span>
        </span>
        <span className="font-display text-lg font-bold text-moss">{money}</span>
        {!readOnly && mode === "idle" ? (
          <Button size="sm" variant="secondary" onClick={() => setMode("choose")}>{t("a.recent.undo")}</Button>
        ) : null}
      </div>

      {mode === "choose" ? (
        <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-paper p-3">
          <Button size="sm" onClick={() => setMode("revision")}>{t("a.recent.askRevision")}</Button>
          <Button size="sm" variant="danger" onClick={() => setMode("reverse")}>{t("a.recent.reverse")}</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>{t("a.common.cancel")}</Button>
        </div>
      ) : null}

      {mode === "revision" || mode === "reverse" ? (
        <form
          className="mt-3 flex flex-col gap-2 rounded-xl bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await reopenSubmission(item.id, comment, mode);
              if (!r.ok) return setError(r.message);
              onDone(
                mode === "revision"
                  ? t("a.recent.doneRevision", { money, kid: item.kidName, comment })
                  : t("a.recent.doneReverse", { money, title: item.title }),
              );
            });
          }}
        >
          <p className="text-sm font-bold">
            {mode === "revision"
              ? t("a.recent.revisionQ", { kid: item.kidName, money })
              : t("a.recent.reverseQ", { money })}
          </p>
          {mode === "revision" ? (
            <div className="flex flex-wrap gap-2">
              {(QUICK[locale] ?? QUICK.en).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setComment(q)}
                  className={`min-h-10 rounded-full px-4 text-sm font-bold ${comment === q ? "bg-plum text-white" : "bg-card ring-1 ring-line"}`}
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("a.recent.typeNote")} maxLength={300} autoFocus />
          {error ? <Alert tone="bad">{error}</Alert> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant={mode === "reverse" ? "danger" : "primary"} disabled={!comment.trim() || pending}>
              {mode === "revision" ? t("a.recent.sendRevision") : t("a.recent.reverseBtn")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>{t("a.common.cancel")}</Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
