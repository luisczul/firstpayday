"use client";

import { useEffect } from "react";

const TEXT_INPUT = /^(text|search|email|number|tel|url|password|date|datetime-local|time)$/;

/** True for fields that bring up the on-screen keyboard. */
export function isTypingElement(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT.test(el.type || "text");
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Bars pinned to the bottom of the screen ride up on top of the keyboard in phone browsers and the
 * apps' web views. While someone types on a touch screen this sets `data-keyboard` on <html>, and
 * CSS (`.unpin-on-keyboard` in globals.css) unpins those bars so they stay at the end of the form.
 * An attribute, not React state: re-rendering a form at the moment a field loses focus swallowed
 * the tap that caused it (e.g. a "+" button right after typing a number).
 */
export function useKeyboardOpen(): void {
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    // iOS slides the keyboard away over ~0.3s after focus leaves (e.g. "Done"). Re-pinning at once
    // parked the bar above the still-closing keyboard, so wait until the screen is full height again.
    // Safari only shrinks the visible area, but the iPhone app shrinks the whole web view (innerHeight
    // too), so "full height" is the tallest the window has been without a keyboard (QA FPI_003).
    let fullHeight = window.innerHeight;
    const visibleHeight = () => Math.min(window.innerHeight, vv?.height ?? window.innerHeight);
    const keyboardStillUp = () => fullHeight - visibleHeight() > 120;
    const resized = () => {
      if (!root.hasAttribute("data-keyboard") && !isTypingElement(document.activeElement)) fullHeight = window.innerHeight;
    };
    // Turning the phone changes what full height is.
    const turned = () => (fullHeight = 0);
    let waiting: ReturnType<typeof setTimeout> | undefined;
    let settling: ReturnType<typeof setTimeout> | undefined;
    const stopWaiting = () => {
      clearTimeout(waiting);
      clearTimeout(settling);
      vv?.removeEventListener("resize", wait);
      window.removeEventListener("resize", wait);
    };
    const unpinned = () => {
      stopWaiting();
      if (!isTypingElement(document.activeElement)) root.removeAttribute("data-keyboard");
    };
    // The keyboard is moving: re-check once the screen has stopped changing size for a moment.
    const wait = () => {
      clearTimeout(settling);
      settling = setTimeout(() => (keyboardStillUp() ? undefined : unpinned()), 150);
    };
    const update = () => {
      stopWaiting();
      if (fullHeight === 0 || window.innerHeight > fullHeight) fullHeight = Math.max(window.innerHeight, vv?.height ?? 0);
      if (isTypingElement(document.activeElement)) return root.setAttribute("data-keyboard", "");
      if (!root.hasAttribute("data-keyboard")) return;
      vv?.addEventListener("resize", wait);
      window.addEventListener("resize", wait);
      wait();
      waiting = setTimeout(unpinned, 1000);
    };
    // Re-pin only once the tap that took focus away has landed. Re-pinning on pointerdown slid the
    // bar under the finger, so the tap hit the bar (e.g. "Add chore") instead of the button pressed.
    // The timeout also lets focus move between fields without the bar flickering.
    let pointerDown = false;
    const down = () => (pointerDown = true);
    const up = () => {
      pointerDown = false;
      setTimeout(update, 0);
    };
    const later = () => {
      if (!pointerDown) setTimeout(update, 0);
    };
    // Focus landing on a button mid-tap must wait too; a field gaining focus unpins right away.
    const focused = () => {
      if (!pointerDown || isTypingElement(document.activeElement)) update();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    document.addEventListener("focusin", focused);
    document.addEventListener("focusout", later);
    window.addEventListener("resize", resized);
    window.addEventListener("orientationchange", turned);
    // A field may already have focus (autoFocus fires before this effect runs).
    update();
    const settled = setTimeout(update, 50);
    return () => {
      clearTimeout(settled);
      stopWaiting();
      window.removeEventListener("resize", resized);
      window.removeEventListener("orientationchange", turned);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      document.removeEventListener("focusin", focused);
      document.removeEventListener("focusout", later);
      root.removeAttribute("data-keyboard");
    };
  }, []);
}
