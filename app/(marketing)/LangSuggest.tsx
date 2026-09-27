"use client";

import { useEffect, useState } from "react";

type Offer = { lang: string; href: string; prompt: string; yes: string; dismiss: string };

const DISMISSED_KEY = "fp_lang_suggest_dismissed";

/**
 * On the English home page, offer (never force) the visitor's browser language.
 * No redirect, so crawlers and people who chose English keep the English page.
 */
export function LangSuggest({ offers }: { offers: Offer[] }) {
  const [offer, setOffer] = useState<Offer | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Storage blocked: still fine to suggest.
    }
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of langs) {
      const base = (tag ?? "").toLowerCase().slice(0, 2);
      if (base === "en") return;
      const match = offers.find((o) => o.lang === base);
      if (match) {
        setOffer(match);
        return;
      }
    }
  }, [offers]);

  if (!offer) return null;
  const dismiss = () => {
    setOffer(null);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  };
  return (
    <div lang={offer.lang} role="region" aria-label={offer.prompt} className="bg-ink px-4 py-2.5 text-sm text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className="font-bold">🌐 {offer.prompt}</span>
        <a href={offer.href} hrefLang={offer.lang} onClick={dismiss} className="rounded-full bg-gold px-4 py-1 font-black text-ink">
          {offer.yes}
        </a>
        <button type="button" onClick={dismiss} className="ml-auto font-bold text-white/80 hover:text-white">
          {offer.dismiss}
        </button>
      </div>
    </div>
  );
}
