"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveHomeStep } from "@/app/actions/household";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { LOCALES, LOCALE_NAMES, isLocale, localeFromBrowser, type Locale } from "@/lib/i18n";
import { SIGNUP_LANG_COOKIE } from "@/lib/i18n/marketing/routes";
import { parentT } from "@/lib/i18n/parent";

const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD", "NZD", "MXN", "BRL"];

/** Timezone regions in the page language (city names stay as the platform spells them). */
const REGIONS: Record<string, Record<Locale, string>> = {
  America: { en: "America", fr: "Amérique", es: "América", pt: "América" },
  Europe: { en: "Europe", fr: "Europe", es: "Europa", pt: "Europa" },
  Africa: { en: "Africa", fr: "Afrique", es: "África", pt: "África" },
  Asia: { en: "Asia", fr: "Asie", es: "Asia", pt: "Ásia" },
  Australia: { en: "Australia", fr: "Australie", es: "Australia", pt: "Austrália" },
  Pacific: { en: "Pacific", fr: "Pacifique", es: "Pacífico", pt: "Pacífico" },
  Atlantic: { en: "Atlantic", fr: "Atlantique", es: "Atlántico", pt: "Atlântico" },
  Indian: { en: "Indian Ocean", fr: "océan Indien", es: "océano Índico", pt: "oceano Índico" },
  Antarctica: { en: "Antarctica", fr: "Antarctique", es: "Antártida", pt: "Antártida" },
  Arctic: { en: "Arctic", fr: "Arctique", es: "Ártico", pt: "Ártico" },
};

/** "America/New_York" → "New York (America)" / "New York (Amérique)". */
function zoneLabel(zone: string, locale: Locale): string {
  const parts = zone.split("/");
  const city = parts[parts.length - 1]!.replaceAll("_", " ");
  return parts.length > 1 ? `${city} (${REGIONS[parts[0]!]?.[locale] ?? parts[0]})` : city;
}

function guessCurrency(): string {
  const region = (navigator.language.split("-")[1] ?? "").toUpperCase();
  const map: Record<string, string> = { CA: "CAD", US: "USD", GB: "GBP", AU: "AUD", NZ: "NZD", MX: "MXN", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", BE: "EUR", PT: "EUR", BR: "BRL" };
  return map[region] ?? "CAD";
}

export function HomeStep({
  initial,
  defaultLocale = "en",
}: {
  initial: { name: string; timezone: string; currency: string; locale: Locale } | null;
  /** Server's guess (signup cookie / Accept-Language), so the first paint is already in the right language. */
  defaultLocale?: Locale;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "America/Toronto");
  const [currency, setCurrency] = useState(initial?.currency ?? "CAD");
  const [locale, setLocale] = useState<Locale>(initial?.locale ?? defaultLocale);
  // The page follows the language picked below, live.
  const t = useMemo(() => parentT(locale), [locale]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (initial) return;
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto");
    setCurrency(guessCurrency());
    // The language the parent signed up in (/signup?lang=… sets this cookie), else the browser's.
    const signupLang = new RegExp(`(?:^|;\\s*)${SIGNUP_LANG_COOKIE}=([a-z]{2})`).exec(document.cookie)?.[1];
    setLocale(isLocale(signupLang) ? signupLang : localeFromBrowser(navigator.language));
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
      <h1 className="font-display text-4xl font-bold text-ink">{t("a.onb.home.title")}</h1>
      <p className="-mt-3 text-ink-soft">{t("a.onb.home.intro")}</p>
      <Field label={t("a.onb.home.name")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("a.onb.home.namePlaceholder")} required maxLength={80} autoFocus />
      </Field>
      <Field label={t("a.onb.home.timezone")} hint={t("a.onb.home.timezoneHint")}>
        <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>{zoneLabel(z, locale)}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("a.onb.home.currency")}>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("a.onb.home.language")}>
          <Select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>{LOCALE_NAMES[l]}</option>
            ))}
          </Select>
        </Field>
      </div>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>{t("a.onb.home.next")}</Button>
    </form>
  );
}
