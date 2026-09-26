"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { enableKioskOnThisDevice } from "@/app/actions/devices";
import { Alert, Button, buttonClass } from "@/components/ui";

export function TabletStep() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 text-center">
      <span className="text-7xl" aria-hidden>📱</span>
      <h1 className="font-display text-4xl font-bold text-ink">Set up this tablet?</h1>
      <p className="text-lg text-ink-soft">
        If this is the tablet in your kitchen, turn it into the kids&apos; board now. You&apos;ll be logged out here, and
        kids will never need a password. Tap <b>Parent</b> in the corner any time to get back in.
      </p>
      <p className="text-sm text-ink-soft">
        Tip: on iPad, tap Share → <b>Add to Home Screen</b> so it opens full-screen like an app.
      </p>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await enableKioskOnThisDevice();
            if (r && !r.ok) setError(r.message);
          })
        }
      >
        Use this device as the kids&apos; tablet
      </Button>
      <Link href="/admin" className={buttonClass("secondary", "lg")}>I&apos;ll do it later</Link>
    </div>
  );
}
