"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, sendMagicLink } from "../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [magic, magicAction, magicPending] = useActionState(sendMagicLink, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {linkError ? <Alert tone="bad">That link expired or was already used. Try again.</Alert> : null}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {magic?.error ? <Alert tone="bad">{magic.error}</Alert> : null}
      {magic?.message ? <Alert tone="good">{magic.message}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
      <Button type="submit" variant="secondary" formAction={magicAction} formNoValidate disabled={magicPending}>
        ✉️ Email me a login link
      </Button>
      <Link href="/reset" className="text-center text-sm font-bold text-ink-soft">
        Forgot your password?
      </Link>
    </form>
  );
}
