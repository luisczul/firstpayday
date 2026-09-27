"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

type Labels = {
  email: string;
  password: string;
  passwordHint: string;
  acceptBefore: string;
  termsLink: string;
  and: string;
  privacyLink: string;
  acceptAfter: string;
  creating: string;
  createButton: string;
};

const EN: Labels = {
  email: "Email",
  password: "Password",
  passwordHint: "At least 8 characters.",
  acceptBefore: "I accept the",
  termsLink: "Terms",
  and: "and",
  privacyLink: "Privacy Policy",
  acceptAfter: ".",
  creating: "Creating…",
  createButton: "Create my account",
};

export function SignupForm({
  next,
  t = EN,
  termsHref = "/terms",
  privacyHref = "/privacy",
}: {
  next?: string;
  t?: Labels;
  termsHref?: string;
  privacyHref?: string;
}) {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label={t.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t.password} hint={t.passwordHint}>
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 accent-maple" />
        <span>
          {t.acceptBefore} <Link href={termsHref} className="font-bold text-maple" target="_blank">{t.termsLink}</Link> {t.and}{" "}
          <Link href={privacyHref} className="font-bold text-maple" target="_blank">{t.privacyLink}</Link>{t.acceptAfter}
        </span>
      </label>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="good">{state.message}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.creating : t.createButton}
      </Button>
    </form>
  );
}
