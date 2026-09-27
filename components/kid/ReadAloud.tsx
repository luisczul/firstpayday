"use client";

import { useEffect, useState } from "react";
import { intlLocale, translator, type Locale } from "@/lib/i18n";

/**
 * "🔊 Read it to me": the device's built-in voice reads the chore to kids who can't read yet.
 * Works offline on iPad / Android in all four languages; hidden where speech isn't available.
 */
export function ReadAloud({ text, locale }: { text: string; locale: Locale }) {
  const tr = translator(locale);
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    // Stop talking when the sheet closes.
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  const speak = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const lang = intlLocale(locale);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9; // a little slower for kids
    const voices = synth.getVoices();
    u.voice = voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(locale)) ?? null;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={speak}
      aria-pressed={speaking}
      className={`flex min-h-12 items-center gap-2 rounded-full px-4 text-lg font-extrabold shadow-[var(--shadow-card)] ring-1 ring-line active:scale-95 ${speaking ? "bg-gold text-ink" : "bg-card text-ink"}`}
    >
      <span aria-hidden>{speaking ? "⏹" : "🔊"}</span>
      {speaking ? tr("kid.readStop") : tr("kid.readToMe")}
    </button>
  );
}
