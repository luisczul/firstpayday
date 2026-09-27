"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createKid } from "@/app/actions/kids";
import { AvatarPicker, saveAvatarChoice, type AvatarChoice } from "@/components/admin/AvatarPicker";
import { Alert, Button, Field, Input } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import Link from "next/link";
import { useParentT } from "@/lib/i18n/parent/client";

export const KID_COLORS = ["#E08A1E", "#B8431F", "#6B7A2E", "#7A3B4A", "#2F6F8F", "#C9962B", "#8A5A9E", "#3C8D6E"];

export function AddKidButton() {
  const router = useRouter();
  const t = useParentT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(KID_COLORS[0]!);
  const [photo, setPhoto] = useState<AvatarChoice>(null);
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createKid({ name, color });
      if (!r.ok) return setError({ message: r.message, limit: r.code === "limit" });
      if (photo) await saveAvatarChoice(r.data!.householdId, r.data!.id, photo);
      setOpen(false);
      setName("");
      setPhoto(null);
      router.refresh();
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("a.kids.add")}</Button>
      <Sheet open={open} title={t("a.kids.addTitle")} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="flex justify-center">
            <AvatarPicker name={name} color={color} onChange={setPhoto} size={120} />
          </div>
          <Field label={t("a.kids.firstName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus />
          </Field>
          <Field label={t("a.kids.color")}>
            <div className="flex flex-wrap gap-2">
              {KID_COLORS.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={`h-10 w-10 rounded-full ${color === c ? "ring-4 ring-ink/30" : ""}`} style={{ background: c }} />
              ))}
            </div>
          </Field>
          {error ? (
            <Alert tone={error.limit ? "warn" : "bad"}>
              {error.message}{" "}
              {error.limit ? <Link href="/admin/settings/billing" className="underline">{t("a.kids.seePlans")}</Link> : null}
            </Alert>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>{t("a.kids.addSubmit")}</Button>
        </form>
      </Sheet>
    </>
  );
}
