"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addKids, setKidAvatar } from "@/app/actions/kids";
import { AvatarPicker, uploadAvatar } from "@/components/admin/AvatarPicker";
import { Alert, Button, Input } from "@/components/ui";

const COLORS = ["#E08A1E", "#B8431F", "#6B7A2E", "#7A3B4A", "#2F6F8F", "#C9962B", "#8A5A9E", "#3C8D6E"];

export function KidsStep({ existing }: { existing: { id: string; name: string; color: string }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<{ name: string; photo: Blob | null }[]>(
    existing.length ? [] : [{ name: "", photo: null }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const named = rows.filter((r) => r.name.trim());
    if (named.length === 0) {
      if (existing.length) return router.push("/onboarding/chores");
      return setError("Add at least one kid.");
    }
    start(async () => {
      const r = await addKids(named.map((k) => k.name));
      if (!r.ok) return setError(r.message);
      const { kids, householdId } = r.data!;
      await Promise.all(
        kids.map(async (kid, i) => {
          const photo = named[i]?.photo;
          if (photo && (await uploadAvatar(householdId, kid.id, photo))) await setKidAvatar(kid.id, true);
        }),
      );
      router.push("/onboarding/chores");
    });
  };

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="font-display text-4xl font-bold text-ink">Add your kids 👧👦</h1>
      <p className="-mt-3 text-ink-soft">Just a first name. A photo is optional: kids love tapping their own face.</p>

      {existing.map((k) => (
        <div key={k.id} className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-line">
          <span className="flex h-14 w-14 items-center justify-center rounded-full font-display text-2xl font-bold text-white" style={{ background: k.color }}>
            {k.name.charAt(0)}
          </span>
          <span className="text-lg font-bold">{k.name}</span>
          <span className="ml-auto text-sm text-moss">✓ Added</span>
        </div>
      ))}

      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-line">
          <AvatarPicker
            name={row.name}
            color={COLORS[(existing.length + i) % COLORS.length]!}
            onChange={(photo) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, photo } : r)))}
            size={72}
          />
          <Input
            aria-label={`Kid ${i + 1} name`}
            placeholder="First name"
            value={row.name}
            maxLength={40}
            autoFocus={i === 0 && existing.length === 0}
            onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
            className="text-lg"
          />
          {rows.length > 1 || existing.length ? (
            <button
              type="button"
              aria-label="Remove"
              className="min-h-11 min-w-11 rounded-full text-xl text-ink-soft"
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, { name: "", photo: null }])}>
        + Add another
      </Button>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Next: pick chores →"}
      </Button>
    </form>
  );
}
