"use client";

import { useState, useTransition } from "react";
import { acceptInvite } from "@/app/actions/invites";
import { Alert, Button } from "@/components/ui";

export function AcceptInvite({
  token,
  signedInAs,
  invitedEmail,
  t,
}: {
  token: string;
  signedInAs: string;
  invitedEmail: string;
  /** Already localized (household language) by the server page. */
  t: { accept: string; mismatch: string };
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const mismatch = signedInAs.toLowerCase() !== invitedEmail.toLowerCase();
  return (
    <div className="flex flex-col gap-3">
      {mismatch ? <Alert tone="warn">{t.mismatch}</Alert> : null}
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <Button
        size="lg"
        disabled={pending || mismatch}
        onClick={() =>
          start(async () => {
            const r = await acceptInvite(token);
            if (r && !r.ok) setError(r.message);
          })
        }
      >
        {t.accept}
      </Button>
    </div>
  );
}
