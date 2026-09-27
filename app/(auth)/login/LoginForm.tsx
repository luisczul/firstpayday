"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, sendMagicLink } from "../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

type Labels = { email: string; password: string; loggingIn: string; loginButton: string; magicLink: string; forgot: string; linkExpired: string };

const EN: Labels = {
  email: "Email",
  password: "Password",
  loggingIn: "Logging in…",
  loginButton: "Log in",
  magicLink: "✉️ Email me a login link",
  forgot: "Forgot your password?",
  linkExpired: "That link expired or was already used. Try again.",
};

export function LoginForm({ next, linkError, t = EN, resetHref = "/reset" }: { next: string; linkError: boolean; t?: Labels; resetHref?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [magic, magicAction, magicPending] = useActionState(sendMagicLink, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {linkError ? <Alert tone="bad">{t.linkExpired}</Alert> : null}
      <Field label={t.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t.password}>
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {magic?.error ? <Alert tone="bad">{magic.error}</Alert> : null}
      {magic?.message ? <Alert tone="good">{magic.message}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.loggingIn : t.loginButton}
      </Button>
      <Button type="submit" variant="secondary" formAction={magicAction} formNoValidate disabled={magicPending}>
        {t.magicLink}
      </Button>
      <Link href={resetHref} className="text-center text-sm font-bold text-ink-soft">
        {t.forgot}
      </Link>
    </form>
  );
}
