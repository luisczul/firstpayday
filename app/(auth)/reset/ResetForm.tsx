"use client";

import { useActionState } from "react";
import { requestReset } from "../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function ResetForm({ t }: { t: { email: string; resetButton: string } }) {
  const [state, action, pending] = useActionState(requestReset, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="good">{state.message}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>{t.resetButton}</Button>
    </form>
  );
}
