"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { KidAvatar } from "@/components/kid/KidAvatar";
import { ParentUnlock } from "@/components/kid/ParentUnlock";
import { usePolling, useWakeLock } from "@/components/kid/hooks";
import { formatMoney } from "@/lib/money/format";
import { translator } from "@/lib/i18n";
import type { KioskHousehold, KioskKid } from "@/lib/kiosk/operations";

export function KidPicker({ initial }: { initial: { household: KioskHousehold; kids: KioskKid[] } }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [unlock, setUnlock] = useState(false);
  const { household, kids } = data;
  const tr = translator(household.locale);
  useWakeLock();

  const refresh = useCallback(async () => {
    const res = await fetch("/api/kiosk/kids", { cache: "no-store" });
    if (res.status === 401) return router.refresh();
    if (res.ok) setData(await res.json());
  }, [router]);
  usePolling(refresh, 5000);

  return (
    <main lang={household.locale} className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-8 pt-6">
        <p className="font-display text-2xl font-bold text-ink-soft">{household.name}</p>
        <button
          type="button"
          onClick={() => setUnlock(true)}
          className="flex min-h-16 items-center gap-2 rounded-full px-5 text-lg font-bold text-ink-soft/80 ring-1 ring-line active:bg-paper-deep"
        >
          🔒 {tr("kid.parent")}
        </button>
      </header>

      <h1 className="mt-4 text-center font-display text-6xl font-extrabold text-ink">{tr("kid.whoIsHere")}</h1>

      {household.paused ? (
        <p className="mx-auto mt-6 rounded-full bg-plum px-6 py-3 text-xl font-bold text-white">{tr("kid.paused")}</p>
      ) : null}

      <div className="flex flex-1 flex-wrap items-center justify-center gap-x-14 gap-y-10 px-8 py-10">
        {kids.length === 0 ? <p className="text-2xl font-bold text-ink-soft">{tr("kid.noKids")}</p> : null}
        {kids.map((kid, i) => (
          <motion.button
            key={kid.id}
            type="button"
            onClick={() => router.push(`/kids/${kid.id}`)}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 22 }}
            whileTap={{ scale: 0.94 }}
            className="flex w-56 flex-col items-center gap-4 rounded-[2rem] p-4"
          >
            <span className="relative">
              <KidAvatar name={kid.name} color={kid.color} avatarUrl={kid.avatarUrl} size={kids.length > 3 ? 150 : 180} />
              {kid.revisions > 0 ? (
                <span className="absolute -top-2 -right-2 flex h-14 min-w-14 animate-bounce items-center justify-center rounded-full bg-plum px-3 text-2xl font-black text-white shadow-[var(--shadow-pop)] ring-4 ring-paper">
                  🛠 {kid.revisions}
                </span>
              ) : null}
            </span>
            <span className="font-display text-4xl font-bold text-ink">{kid.name}</span>
            <span className="rounded-full bg-card px-5 py-2 text-3xl font-black text-moss shadow-[var(--shadow-card)]">
              {formatMoney(kid.balanceCents, household.currency, household.locale)}
            </span>
          </motion.button>
        ))}
      </div>

      {unlock ? <ParentUnlock locale={household.locale} onClose={() => setUnlock(false)} /> : null}
    </main>
  );
}
