"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 accent-maple" />
        <span>
          I accept the <Link href="/terms" className="font-bold text-maple" target="_blank">Terms</Link> and{" "}
          <Link href="/privacy" className="font-bold text-maple" target="_blank">Privacy Policy</Link>.
        </span>
      </label>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="good">{state.message}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create my account"}
      </Button>
    </form>
  );
}
