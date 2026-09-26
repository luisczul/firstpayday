"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveHomeStep } from "@/app/actions/household";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD", "NZD", "MXN"];

/** "America/New_York" → "New York (America)". */
function zoneLabel(zone: string): string {
  const parts = zone.split("/");
  const city = parts[parts.length - 1]!.replaceAll("_", " ");
  return parts.length > 1 ? `${city} (${parts[0]})` : city;
}

function guessCurrency(): string {
  const region = (navigator.language.split("-")[1] ?? "").toUpperCase();
  const map: Record<string, string> = { CA: "CAD", US: "USD", GB: "GBP", AU: "AUD", NZ: "NZD", MX: "MXN", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", BE: "EUR" };
  return map[region] ?? "CAD";
}

export function HomeStep({ initial }: { initial: { name: string; timezone: string; currency: string; locale: "en" | "fr" } | null }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "America/Toronto");
  const [currency, setCurrency] = useState(initial?.currency ?? "CAD");
  const [locale, setLocale] = useState<"en" | "fr">(initial?.locale ?? "en");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (initial) return;
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto");
    setCurrency(guessCurrency());
    setLocale(navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en");
  }, [initial]);

  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["America/Toronto"];
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveHomeStep({ name, timezone, currency, locale });
      if (r && !r.ok) setError(r.message);
    });
  };

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="font-display text-4xl font-bold text-ink">Name your home 🏡</h1>
      <p className="-mt-3 text-ink-soft">This is what your kids will see at the top of the tablet.</p>
      <Field label="Home name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Czul family" required maxLength={80} autoFocus />
      </Field>
      <Field label="Timezone" hint="Chores come back at midnight in this timezone.">
        <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>{zoneLabel(z)}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Currency">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Language">
          <Select value={locale} onChange={(e) => setLocale(e.target.value as "en" | "fr")}>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </Select>
        </Field>
      </div>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>Next: add your kids →</Button>
    </form>
  );
}
