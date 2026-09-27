"use client";

import { useActionState } from "react";
import { updatePassword } from "../../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function UpdatePasswordForm({ t }: { t: { newPassword: string; passwordHint: string; savePassword: string } }) {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t.newPassword} hint={t.passwordHint}>
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>{t.savePassword}</Button>
    </form>
  );
}
