"use client";

import { useMemo } from "react";
import { Select } from "@/components/ui";
import { CURRENCY_COPY, currencyOptions } from "@/lib/money/currencies";

/** Household currency picker: every 2-decimal currency, grouped, named in the parent's language. */
export function CurrencySelect({ value, onChange, locale }: { value: string; onChange: (code: string) => void; locale: string }) {
  const options = useMemo(() => currencyOptions(locale), [locale]);
  const copy = CURRENCY_COPY[locale] ?? CURRENCY_COPY.en!;
  const known = options.some((o) => o.code === value);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {!known ? <option value={value}>{value}</option> : null}
      <optgroup label={copy.common}>
        {options.filter((o) => o.common).map((o) => (
          <option key={o.code} value={o.code}>{o.label}</option>
        ))}
      </optgroup>
      <optgroup label={copy.all}>
        {options.filter((o) => !o.common).map((o) => (
          <option key={o.code} value={o.code}>{o.label}</option>
        ))}
      </optgroup>
    </Select>
  );
}
