"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { updatePassword } from "../../actions";
import { Alert, Button, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Copy = { newPassword: string; passwordHint: string; savePassword: string; expired: string; sendNew: string };

export function UpdatePasswordForm({ t }: { t: Copy }) {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  // "checking" until the link's session (in the URL after "#") is signed in, so nobody types a new
  // password into a link that already expired.
  const [link, setLink] = useState<"checking" | "ok" | "expired">("checking");

  useEffect(() => {
    const supabase = createClient();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    void (async () => {
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        return setLink(error ? "expired" : "ok");
      }
      // Older links (or "#error=…otp_expired"): fine only if a session is already here.
      const { data } = await supabase.auth.getUser();
      setLink(!hash.get("error") && data.user ? "ok" : "expired");
    })();
  }, []);

  if (link === "expired") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="bad">{t.expired}</Alert>
        <Link href="/reset" className="text-center font-bold text-maple underline">{t.sendNew}</Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t.newPassword} hint={t.passwordHint}>
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required disabled={link !== "ok"} />
      </Field>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending || link !== "ok"}>{t.savePassword}</Button>
    </form>
  );
}
