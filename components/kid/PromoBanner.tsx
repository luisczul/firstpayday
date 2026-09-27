"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/money/format";
import { intlLocale, translator, type Locale } from "@/lib/i18n";
import type { Promotion } from "@/lib/money/promotions";

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Festive banner on the kid's board while a promotion is live, with a countdown. */
export function PromoBanner({
  promos,
  currency,
  locale,
  timeZone,
  serverNow,
}: {
  promos: Promotion[];
  currency: string;
  locale: Locale;
  timeZone: string;
  /** Board fetch time, so a tablet with a wrong clock still counts down right. */
  serverNow: string;
}) {
  const tr = translator(locale);
  // Start from the server's clock (same text on server and client), then tick.
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    const id = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(id);
  }, [serverNow]);

  const live = promos.filter((p) => new Date(p.endsAt).getTime() > now);
  if (live.length === 0) return null;

  const zone = timeZone; // explicit name: see lib/schedule/tz.ts about the minifier
  const until = (iso: string) => {
    const end = new Date(iso);
    const sameDay =
      new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(end) === new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date(now));
    const text = end.toLocaleString(intlLocale(locale), {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      ...(sameDay ? {} : { weekday: "long" }),
    });
    if (locale !== "es") return text;
    // Spanish needs the article: "hasta las 6:00 p.m.", "hasta la 1:35 a.m.", "hasta el domingo, 1:35 a.m.".
    if (!sameDay) return `el ${text}`;
    const hour = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hour12: true }).format(end);
    return `${hour.startsWith("1 ") ? "la" : "las"} ${text}`;
  };

  return (
    <div className="mx-6 mt-2 flex flex-col gap-2 md:mx-8" role="status" aria-live="polite">
      {live.map((p) => (
        <div
          key={p.id}
          className="flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-r from-maple via-amber to-gold px-6 py-4 text-white shadow-[var(--shadow-pop)]"
        >
          <span className="text-5xl" aria-hidden>🎉</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-3xl font-extrabold drop-shadow-sm">
              {p.bonusKind === "flat"
                ? tr("kid.promoBannerFlat", { amount: formatPrice(p.bonusValue, currency, locale), time: until(p.endsAt) })
                : tr("kid.promoBannerPercent", { percent: p.bonusValue, time: until(p.endsAt) })}
            </span>
            <span className="block text-lg font-bold opacity-95">{p.name}</span>
          </span>
          <span className="rounded-full bg-white px-5 py-2 text-xl font-black text-maple tabular-nums">
            ⏰ {tr("kid.promoEndsIn", { time: countdown(new Date(p.endsAt).getTime() - now) })}
          </span>
        </div>
      ))}
    </div>
  );
}
