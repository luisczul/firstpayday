"use client";

import { useState, useTransition } from "react";
import { acceptInvite } from "@/app/actions/invites";
import { Alert, Button } from "@/components/ui";

export function AcceptInvite({ token, signedInAs, invitedEmail }: { token: string; signedInAs: string; invitedEmail: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const mismatch = signedInAs.toLowerCase() !== invitedEmail.toLowerCase();
  return (
    <div className="flex flex-col gap-3">
      {mismatch ? (
        <Alert tone="warn">
          You&apos;re logged in as {signedInAs}, but this invite is for {invitedEmail}. Log out and use that email.
        </Alert>
      ) : null}
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
        Accept invite
      </Button>
    </div>
  );
}
