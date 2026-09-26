"use client";

import { useEffect, useRef, useState } from "react";

/** Calls onIdle after `seconds` without touches/keys/scrolls. */
export function useIdle(seconds: number, onIdle: () => void) {
  const cb = useRef(onIdle);
  cb.current = onIdle;
  useEffect(() => {
    let timer = window.setTimeout(() => cb.current(), seconds * 1000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => cb.current(), seconds * 1000);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true, capture: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, reset, { capture: true });
    };
  }, [seconds]);
}

/** Keep the tablet screen on while visible; silently tolerate refusal. */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          lock = await navigator.wakeLock.request("screen");
          if (cancelled) await lock.release();
        }
      } catch {
        // Not supported, low battery, or denied: fine.
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);
}

/** Poll a function every `ms` while the page is visible (kiosk live refresh). */
export function usePolling(fn: () => void, ms: number) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") cb.current();
    };
    const id = window.setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [ms]);
}

const SOUND_KEY = "chore-board:sound";

/** Per-tablet sound preference, muted by default (SPEC §6). */
export function useSoundPref(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(window.localStorage.getItem(SOUND_KEY) === "1");
    } catch {
      // storage blocked
    }
  }, []);
  const set = (v: boolean) => {
    setOn(v);
    try {
      window.localStorage.setItem(SOUND_KEY, v ? "1" : "0");
    } catch {
      // storage blocked
    }
  };
  return [on, set];
}

/** A short happy two-note chime, synthesized (no audio files). Only after a tap. */
export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = [659.25, 987.77]; // E5, B5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // no audio
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export async function fireConfetti() {
  if (prefersReducedMotion()) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#B8431F", "#E08A1E", "#F2C14E", "#6B7A2E", "#7A3B4A"];
  confetti({ particleCount: 140, spread: 90, origin: { y: 0.65 }, colors, scalar: 1.2 });
  window.setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { x: 0.2, y: 0.7 }, colors }), 180);
  window.setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { x: 0.8, y: 0.7 }, colors }), 320);
}
