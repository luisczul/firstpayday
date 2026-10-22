"use client";

import { useEffect } from "react";

type Bridge = { android?: { setPullBlocked(blocked: boolean): void }; ios?: { postMessage(blocked: boolean): void } };

function bridge(): Bridge | null {
  const w = window as unknown as {
    FirstPaydayAndroid?: Bridge["android"];
    webkit?: { messageHandlers?: { pullRefresh?: Bridge["ios"] } };
  };
  if (w.FirstPaydayAndroid) return { android: w.FirstPaydayAndroid };
  if (w.webkit?.messageHandlers?.pullRefresh) return { ios: w.webkit.messageHandlers.pullRefresh };
  return null;
}

/** True when a pull down here should scroll the page's content, not reload it. */
export function pullShouldScroll(target: EventTarget | null): boolean {
  // A sheet or dialog is open (e.g. making a chore): reloading would throw away what was typed.
  if (document.querySelector('[role="dialog"]')) return true;
  // The finger is on something scrolled down inside the page (it scrolls back up first).
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
  }
  return false;
}

/**
 * Inside the apps, pull to refresh reloads the page. The app only sees its own scroll position, so
 * the page tells it, at each touch, when a pull must not reload (FP_023).
 */
export function NativePullGuard() {
  useEffect(() => {
    const b = bridge();
    if (!b) return;
    const onTouch = (e: TouchEvent) => {
      const blocked = pullShouldScroll(e.target);
      b.android?.setPullBlocked(blocked);
      b.ios?.postMessage(blocked);
    };
    document.addEventListener("touchstart", onTouch, { capture: true, passive: true });
    return () => document.removeEventListener("touchstart", onTouch, { capture: true });
  }, []);
  return null;
}
