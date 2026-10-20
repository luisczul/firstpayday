"use client";

import { useState, useTransition } from "react";
import { acceptInviteById } from "@/app/actions/invites";
import { Alert, Button, Card } from "@/components/ui";
import { useParentT } from "@/lib/i18n/parent/client";

/**
 * A parent invited to an existing home who signed up without the email's link (e.g. in the app):
 * join that home instead of creating a new one.
 */
export function JoinInvites({ invites }: { invites: { id: string; role: string; home: string }[] }) {
  const t = useParentT();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="mb-8 ring-2 ring-moss/40">
      <h2 className="font-display text-2xl font-bold text-ink">✉️ {t("b.onb.invited.title")}</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-ink">
              {t("b.onb.invited.body", { home: i.home, role: i.role === "owner" ? t("b.members.roleOwner") : t("b.members.roleParent") })}
            </span>
            <Button
              variant="success"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await acceptInviteById(i.id);
                  if (r && !r.ok) setError(r.message ?? null);
                })
              }
            >
              {t("b.onb.invited.join", { home: i.home })}
            </Button>
          </li>
        ))}
      </ul>
      {error ? <div className="mt-3"><Alert tone="bad">{error}</Alert></div> : null}
      <p className="mt-4 text-sm text-ink-soft">{t("b.onb.invited.orOwn")}</p>
    </Card>
  );
}
