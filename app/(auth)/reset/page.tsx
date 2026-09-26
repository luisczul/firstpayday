"use client";

import { useActionState } from "react";
import { requestReset } from "../actions";
import { AuthShell } from "../AuthShell";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ResetPage() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  return (
    <AuthShell title="Reset your password">
      <form action={action} className="flex flex-col gap-4">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
        {state?.message ? <Alert tone="good">{state.message}</Alert> : null}
        <Button type="submit" size="lg" disabled={pending}>Send reset link</Button>
      </form>
    </AuthShell>
  );
}
