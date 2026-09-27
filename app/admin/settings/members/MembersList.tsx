"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelInvite, inviteMember, removeMember, resendInvite } from "@/app/actions/members";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { intlLocale } from "@/lib/i18n";
import { useParentLocale, useParentT } from "@/lib/i18n/parent/client";

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
  const t = useParentT();
  const locale = useParentLocale();
  const roleLabel = (r: string) => (r === "owner" ? t("b.members.roleOwner") : r === "parent" ? t("b.members.roleParent") : r);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"parent" | "owner">("parent");
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "warn"; text: string; link?: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-3 font-display text-xl font-bold">
          {t("b.members.parents")} <span className="text-base text-ink-soft">{t("b.devices.ofLimit", { n: members.length + invites.length, limit })}</span>
        </h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{m.display_name || m.email}</span>
                {m.display_name ? <span className="block text-xs text-ink-soft">{m.email}</span> : null}
              </span>
              <Badge tone={m.role === "owner" ? "warn" : "neutral"}>{roleLabel(m.role)}</Badge>
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
                  {m.user_id === meId ? t("b.members.leave") : t("b.common.remove")}
                </Button>
              ) : null}
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink-soft">{i.email}</span>
                <span className="block text-xs text-ink-soft">
                  {t("b.members.invited", { date: new Date(i.expires_at).toLocaleDateString(intlLocale(locale)) })}
                </span>
              </span>
              <Badge>{roleLabel(i.role)}</Badge>
              {isOwner ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await resendInvite(i.id);
                        if (!r.ok) return setMsg({ tone: "bad", text: r.message });
                        setMsg(
                          r.data!.emailed
                            ? { tone: "good", text: t("b.members.resent", { email: r.data!.email }) }
                            : { tone: "warn", text: t("b.members.noEmail"), link: r.data!.link },
                        );
                        router.refresh();
                      })
                    }
                  >
                    ↻ {t("b.members.resend")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => start(async () => { await cancelInvite(i.id); router.refresh(); })}>
                    {t("b.common.cancel")}
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {isOwner ? (
        <Card>
          <h2 className="mb-3 font-display text-xl font-bold">{t("b.members.inviteTitle")}</h2>
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
                    ? { tone: "good", text: t("b.members.inviteSent") }
                    : { tone: "warn", text: t("b.members.noEmail"), link: r.data!.link },
                );
                router.refresh();
              });
            }}
          >
            <Field label={t("b.members.email")}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="min-w-64" />
            </Field>
            <Field label={t("b.members.role")}>
              <Select value={role} onChange={(e) => setRole(e.target.value as "parent" | "owner")}>
                <option value="parent">{t("b.members.optParent")}</option>
                <option value="owner">{t("b.members.optOwner")}</option>
              </Select>
            </Field>
            <Button type="submit" disabled={pending}>{t("b.members.send")}</Button>
          </form>
        </Card>
      ) : null}

      {msg ? (
        <Alert tone={msg.tone}>
          {msg.text}
          {msg.link ? (
            <span className="mt-2 flex gap-2">
              <input readOnly value={msg.link} className="flex-1 rounded-lg bg-card px-2 py-1 text-xs" onFocus={(e) => e.target.select()} />
              <button type="button" className="font-bold underline" onClick={() => void navigator.clipboard.writeText(msg.link!)}>{t("b.members.copy")}</button>
            </span>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
