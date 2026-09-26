"use client";

import Link from "next/link";
import { useTransition } from "react";
import { extendTrial, setComp } from "@/app/actions/platform";

export function HouseholdActions({
  householdId,
  isComp,
  canExtend,
  stripeUrl,
}: {
  householdId: string;
  isComp: boolean;
  canExtend: boolean;
  stripeUrl: string | null;
}) {
  const [pending, start] = useTransition();
  const btn = "rounded-lg px-2 py-1 text-xs font-bold ring-1 ring-line hover:bg-paper disabled:opacity-40";
  return (
    <div className="flex flex-wrap gap-1">
      <button className={btn} disabled={pending} onClick={() => start(() => setComp(householdId, !isComp))}>
        {isComp ? "Remove comp" : "Set comp"}
      </button>
      {canExtend ? (
        <>
          <button className={btn} disabled={pending} onClick={() => start(() => extendTrial(householdId, 7))}>+7d</button>
          <button className={btn} disabled={pending} onClick={() => start(() => extendTrial(householdId, 14))}>+14d</button>
        </>
      ) : null}
      {stripeUrl ? <a className={btn} href={stripeUrl} target="_blank" rel="noreferrer">Stripe ↗</a> : null}
      <Link className={btn} href={`/platform?view=${householdId}`}>View</Link>
    </div>
  );
}
