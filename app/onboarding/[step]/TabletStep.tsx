"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { enableKioskOnThisDevice } from "@/app/actions/devices";
import { Alert, Button, buttonClass } from "@/components/ui";
import { FamilyTaxCard } from "@/components/admin/FamilyTaxCard";
import { taxPromoCopy } from "@/lib/i18n/taxPromoCopy";
import type { Locale } from "@/lib/i18n";
import { useParentT } from "@/lib/i18n/parent/client";
import { rich } from "@/lib/i18n/parent/rich";

export function TabletStep({
  familyTax,
  currency,
  locale,
}: {
  familyTax: { enabled: boolean; percent: number };
  currency: string;
  locale: Locale;
}) {
  const t = useParentT();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 text-center">
      <span className="text-7xl" aria-hidden>📱</span>
      <h1 className="font-display text-4xl font-bold text-ink">{t("a.onb.tablet.title")}</h1>
      <p className="text-lg text-ink-soft">
        {rich(t("a.onb.tablet.intro"), { parent: <b>{t("a.onb.tablet.parent")}</b> })}
      </p>
      <p className="text-sm text-ink-soft">
        {rich(t("a.onb.tablet.tip"), { a2hs: <b>{t("a.onb.tablet.a2hs")}</b> })}
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
        {t("a.onb.tablet.use")}
      </Button>
      <Link href="/admin" className={buttonClass("secondary", "lg")}>{t("a.onb.tablet.later")}</Link>
      <div className="mt-4 border-t border-line pt-6">
        <FamilyTaxCard
          initial={familyTax}
          currency={currency}
          locale={locale}
          title={taxPromoCopy(locale).taxOnboardingTitle}
          autoSave
        />
      </div>
    </div>
  );
}
