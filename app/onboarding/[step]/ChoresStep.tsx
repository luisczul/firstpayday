"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addChoresFromTemplates } from "@/app/actions/chores";
import { TemplatePicker } from "@/components/admin/TemplatePicker";
import { Alert } from "@/components/ui";
import type { ChoreTemplate } from "@/lib/templates";

export function ChoresStep({
  templates,
  existingKeys,
  currency,
  locale,
}: {
  templates: ChoreTemplate[];
  existingKeys: string[];
  currency: string;
  locale: "en" | "fr";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-ink">Pick your chores 🧹</h1>
          <p className="mt-1 text-ink-soft">
            Everything is selected. Tap a card to skip it, and tweak prices or how often it repeats.
          </p>
        </div>
        {existingKeys.length ? (
          <Link href="/onboarding/tablet" className="shrink-0 font-bold text-maple">Skip →</Link>
        ) : null}
      </div>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <TemplatePicker
        templates={templates}
        excludeKeys={existingKeys}
        currency={currency}
        locale={locale}
        busy={pending}
        submitLabel={pending ? "Adding…" : "Next: the tablet →"}
        onSubmit={(picks) =>
          start(async () => {
            const r = await addChoresFromTemplates(picks);
            if (!r.ok) return setError(r.message);
            router.push("/onboarding/tablet");
          })
        }
      />
    </div>
  );
}
