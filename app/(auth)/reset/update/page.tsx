"use client";

import { useActionState } from "react";
import { updatePassword } from "../../actions";
import { AuthShell } from "../../AuthShell";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function UpdatePasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <AuthShell title="Choose a new password">
      <form action={action} className="flex flex-col gap-4">
        <Field label="New password" hint="At least 8 characters.">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
        <Button type="submit" size="lg" disabled={pending}>Save password</Button>
      </form>
    </AuthShell>
  );
}
