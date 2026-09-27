"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendShareInvites, type ShareResult } from "@/app/actions/share";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";
import { useParentT } from "@/lib/i18n/parent/client";
import type { ParentKey } from "@/lib/i18n/parent";

const MAX = 10;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const RESULT_KEY: Record<ShareResult["status"], ParentKey> = {
  sent: "c.share.result.sent",
  recent: "c.share.result.recent",
  member: "c.share.result.member",
  failed: "c.share.result.failed",
  limit: "c.share.result.limit",
  self: "c.share.result.self",
};

/** "a@x.com, b@y.com\nc@z.com" → unique lowercase addresses, and the ones that don't look like emails. */
function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = [...new Set(parts.filter((p) => EMAIL.test(p)))];
  const invalid = [...new Set(parts.filter((p) => !EMAIL.test(p)))];
  return { valid, invalid };
}

export function ShareForm({ defaultName, defaultLocale }: { defaultName: string; defaultLocale: Locale }) {
  const t = useParentT();
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState("");
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ShareResult[] | null>(null);
  const [pending, start] = useTransition();
  const { valid, invalid } = useMemo(() => parseEmails(raw), [raw]);
  const tooMany = valid.length > MAX;
  const canSend = valid.length > 0 && !tooMany && invalid.length === 0 && name.trim().length > 0 && !pending;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend) return;
        setError(null);
        setResults(null);
        start(async () => {
          const r = await sendShareInvites({ emails: valid, senderName: name, note: note.trim() || null, locale });
          if (!r.ok) return setError(r.message);
          setResults(r.data?.results ?? []);
          // Ready for the next friend: clear the emails and the message (your name and language stay).
          setRaw("");
          setNote("");
          router.refresh();
        });
      }}
    >
      <Field
        label={t("c.share.emails")}
        hint={`${t("c.share.emailsHint")} · ${t("c.share.count", { count: valid.length })}`}
        error={
          invalid.length > 0 ? t("c.share.invalidList", { list: invalid.slice(0, 5).join(", ") }) : tooMany ? t("c.err.tooMany") : null
        }
      >
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={3}
          placeholder={t("c.share.emailsPlaceholder")}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      {valid.length > 0 ? (
        <ul className="-mt-2 flex flex-wrap gap-2">
          {valid.map((v) => (
            <li key={v} className="rounded-full bg-paper px-3 py-1 text-sm font-bold text-ink ring-1 ring-line">
              {v}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("c.share.yourName")} hint={t("c.share.yourNameHint", { name: name.trim() || "…" })}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoComplete="given-name" />
        </Field>
        <Field label={t("c.share.language")} hint={t("c.share.languageHint")}>
          <Select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("c.share.note")} hint={t("c.share.noteCount", { count: note.length })}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} placeholder={t("c.share.notePlaceholder")} />
      </Field>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {results && results.length > 0 ? (
        <div role="status" className="rounded-2xl bg-paper p-4 ring-1 ring-line">
          <p className="mb-2 font-bold">{t("c.share.resultsTitle")}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {results.map((r) => (
              <li key={r.email} className="flex flex-wrap justify-between gap-2">
                <span className="font-bold break-all">{r.email}</span>
                <span className={r.status === "sent" ? "font-bold text-moss" : "text-ink-soft"}>{t(RESULT_KEY[r.status])}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <Button type="submit" size="lg" disabled={!canSend}>
          {pending ? t("c.share.sending") : t("c.share.send")}
        </Button>
      </div>
    </form>
  );
}
