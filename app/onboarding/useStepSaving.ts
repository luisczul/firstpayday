"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Saving…" state for an onboarding step's Next button, plus fresh data when the parent comes back.
 *
 * Swiping back on an iPhone (QA FPI_002) brought back the step from the browser's memory: Next was
 * still stuck on "Saving…" (the move to the next step had been cut off), and Add your kids still
 * thought no kids were added, so Next asked for a kid again. Now coming back clears "Saving…" and
 * reloads the step's data.
 */
export function useStepSaving(): [boolean, (on: boolean) => void] {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    // A step shown again after Back is mounted again, so this also runs then.
    router.refresh();
    const back = () => setSaving(false);
    const shown = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setSaving(false);
      router.refresh();
    };
    window.addEventListener("popstate", back);
    window.addEventListener("pageshow", shown);
    return () => {
      window.removeEventListener("popstate", back);
      window.removeEventListener("pageshow", shown);
    };
  }, [router]);
  return [saving, setSaving];
}
