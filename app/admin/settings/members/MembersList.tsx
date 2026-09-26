"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelInvite, inviteMember, removeMember } from "@/app/actions/members";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";

export function MembersList({
  members,
  invites,
  meId,
  isOwner,
  limit,
}: {
  members: { user_id: string; role: string; display_name: string | null; email: string }[];
  invites: { id: string; email: string; role: string; expires_at: string }[];
  meId: string;
  isOwner: boolean;
  limit: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"parent" | "owner">("parent");
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "warn"; text: string; link?: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-3 font-display text-xl font-bold">
          Parents <span className="text-base text-ink-soft">({members.length + invites.length} of {limit})</span>
        </h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{m.display_name || m.email}</span>
                {m.display_name ? <span className="block text-xs text-ink-soft">{m.email}</span> : null}
              </span>
              <Badge tone={m.role === "owner" ? "warn" : "neutral"}>{m.role}</Badge>
              {(isOwner && m.user_id !== meId) || m.user_id === meId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await removeMember(m.user_id);
                      if (!r.ok) setMsg({ tone: "bad", text: r.message });
                      router.refresh();
                    })
                  }
                >
                  {m.user_id === meId ? "Leave" : "Remove"}
                </Button>
              ) : null}
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink-soft">{i.email}</span>
                <span className="block text-xs text-ink-soft">Invited · expires {new Date(i.expires_at).toLocaleDateString()}</span>
              </span>
              <Badge>{i.role}</Badge>
              {isOwner ? (
                <Button size="sm" variant="ghost" onClick={() => start(async () => { await cancelInvite(i.id); router.refresh(); })}>
                  Cancel
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {isOwner ? (
        <Card>
          <h2 className="mb-3 font-display text-xl font-bold">Invite a co-parent</h2>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await inviteMember({ email, role });
                if (!r.ok) return setMsg({ tone: r.code === "limit" ? "warn" : "bad", text: r.message });
                setEmail("");
                setMsg(
                  r.data!.emailed
                    ? { tone: "good", text: "Invite sent by email." }
                    : { tone: "warn", text: "Email isn't set up yet, so share this link with them:", link: r.data!.link },
                );
                router.refresh();
              });
            }}
          >
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="min-w-64" />
            </Field>
            <Field label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value as "parent" | "owner")}>
                <option value="parent">Parent</option>
                <option value="owner">Owner (can manage billing)</option>
              </Select>
            </Field>
            <Button type="submit" disabled={pending}>Send invite</Button>
          </form>
        </Card>
      ) : null}

      {msg ? (
        <Alert tone={msg.tone}>
          {msg.text}
          {msg.link ? (
            <span className="mt-2 flex gap-2">
              <input readOnly value={msg.link} className="flex-1 rounded-lg bg-card px-2 py-1 text-xs" onFocus={(e) => e.target.select()} />
              <button type="button" className="font-bold underline" onClick={() => void navigator.clipboard.writeText(msg.link!)}>Copy</button>
            </span>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
