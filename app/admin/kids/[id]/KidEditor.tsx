"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setKidArchived, updateKid } from "@/app/actions/kids";
import { AvatarPicker, saveAvatarChoice, type AvatarChoice } from "@/components/admin/AvatarPicker";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { KID_COLORS } from "../AddKidButton";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";
import { useParentT } from "@/lib/i18n/parent/client";

export function KidEditor({
  kid,
  avatarUrl,
  householdId,
  readOnly,
}: {
  kid: { id: string; name: string; color: string; sort_order: number; archived: boolean; locale: Locale | null };
  avatarUrl: string | null;
  householdId: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const t = useParentT();
  const [name, setName] = useState(kid.name);
  const [color, setColor] = useState(kid.color);
  const [order, setOrder] = useState<number | null>(kid.sort_order);
  const [lang, setLang] = useState<"" | Locale>(kid.locale ?? "");
  const [photo, setPhoto] = useState<AvatarChoice | undefined>(undefined);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (order === null) return setMsg({ tone: "bad", text: t("a.kid.orderRequired") });
    start(async () => {
      const r = await updateKid(kid.id, { name, color, sort_order: order, locale: lang || null });
      if (!r.ok) return setMsg({ tone: "bad", text: r.message });
      if (photo !== undefined) await saveAvatarChoice(householdId, kid.id, photo);
      setMsg({ tone: "good", text: t("a.common.saved") });
      router.refresh();
    });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] ring-1 ring-line md:flex-row md:items-start">
      <AvatarPicker name={name} color={color} initialUrl={avatarUrl} onChange={setPhoto} size={120} />
      <fieldset disabled={readOnly} className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
          <Field label={t("a.kid.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className="text-lg font-bold" />
          </Field>
          <Field label={t("a.kid.order")}>
            <Input inputMode="numeric" value={order ?? ""} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setOrder(d === "" ? null : Number(d)); }} />
          </Field>
        </div>
        <Field label={t("a.kid.boardLanguage")} hint={t("a.kid.boardLanguageHint")}>
          <Select value={lang} onChange={(e) => setLang(e.target.value as "" | Locale)}>
            <option value="">{t("a.kid.sameAsHousehold")}</option>
            {LOCALES.map((l) => (
              <option key={l} value={l}>{LOCALE_NAMES[l]}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("a.kids.color")}>
          <div className="flex flex-wrap gap-2">
            {KID_COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={`h-10 w-10 rounded-full ${color === c ? "ring-4 ring-ink/30" : ""}`} style={{ background: c }} />
            ))}
          </div>
        </Field>
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>{t("a.common.save")}</Button>
        </div>
      </fieldset>
      {/* Outside the fieldset: archiving stays possible while read-only (it's how you get back to free). */}
      <div className="flex items-start md:ml-auto">
        <Button
          type="button"
          variant={kid.archived ? "secondary" : "danger"}
          disabled={pending || (kid.archived && readOnly)}
          onClick={() =>
            start(async () => {
              const r = await setKidArchived(kid.id, !kid.archived);
              if (!r.ok) setMsg({ tone: "bad", text: r.message });
              router.refresh();
            })
          }
        >
          {kid.archived ? t("a.kid.restore") : t("a.kid.archive")}
        </Button>
      </div>
    </form>
  );
}
