"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setKidArchived, setKidAvatar, updateKid } from "@/app/actions/kids";
import { AvatarPicker, uploadAvatar } from "@/components/admin/AvatarPicker";
import { Alert, Button, Field, Input } from "@/components/ui";
import { KID_COLORS } from "../AddKidButton";

export function KidEditor({
  kid,
  avatarUrl,
  householdId,
  readOnly,
}: {
  kid: { id: string; name: string; color: string; sort_order: number; archived: boolean };
  avatarUrl: string | null;
  householdId: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(kid.name);
  const [color, setColor] = useState(kid.color);
  const [order, setOrder] = useState(kid.sort_order);
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await updateKid(kid.id, { name, color, sort_order: order });
      if (!r.ok) return setMsg({ tone: "bad", text: r.message });
      if (photo) {
        if (await uploadAvatar(householdId, kid.id, photo)) await setKidAvatar(kid.id, true);
      } else if (photo === null) {
        await setKidAvatar(kid.id, false);
      }
      setMsg({ tone: "good", text: "Saved" });
      router.refresh();
    });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] ring-1 ring-line md:flex-row md:items-start">
      <AvatarPicker name={name} color={color} initialUrl={avatarUrl} onChange={setPhoto} size={120} />
      <fieldset disabled={readOnly} className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className="text-lg font-bold" />
          </Field>
          <Field label="Order">
            <Input type="number" min={0} value={order} onChange={(e) => setOrder(Number(e.target.value) || 0)} />
          </Field>
        </div>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {KID_COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={`h-10 w-10 rounded-full ${color === c ? "ring-4 ring-ink/30" : ""}`} style={{ background: c }} />
            ))}
          </div>
        </Field>
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>Save</Button>
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
          {kid.archived ? "Restore" : "Archive"}
        </Button>
      </div>
    </form>
  );
}
