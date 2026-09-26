"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { pinParents, unlockWithPassword, unlockWithPin, type PinParent } from "@/app/kids/actions";
import { translator, type Locale } from "@/lib/i18n";

const LAST_EMAIL_KEY = "chore-board:last-parent-email";

export function ParentUnlock({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const tr = translator(locale);
  const [mode, setMode] = useState<"loading" | "pin" | "password">("loading");
  const [parents, setParents] = useState<PinParent[]>([]);
  const [who, setWho] = useState<PinParent | null>(null);
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      setEmail(window.localStorage.getItem(LAST_EMAIL_KEY) ?? "");
    } catch {
      // storage blocked
    }
    void pinParents().then((list) => {
      setParents(list);
      setWho(list[0] ?? null);
      setMode(list.length > 0 ? "pin" : "password");
    });
  }, []);

  const done = () => {
    // Full navigation so middleware sees the fresh cookies.
    window.location.assign("/admin");
  };

  const fail = (reason: string) => setError(reason === "locked" ? tr("unlock.locked") : tr("unlock.wrong"));

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await unlockWithPassword({ email: email.trim(), password });
      if (r.ok) {
        try {
          window.localStorage.setItem(LAST_EMAIL_KEY, email.trim());
        } catch {
          // storage blocked
        }
        done();
      } else fail(r.reason);
    });
  };

  const pressDigit = (d: string) => {
    if (pending || !who) return;
    const next = (pin + d).slice(0, 6);
    setPin(next);
    setError(null);
  };

  const submitPin = () => {
    if (!who || pin.length < 4) return;
    start(async () => {
      const r = await unlockWithPin({ userId: who.userId, pin });
      setPin("");
      if (r.ok) done();
      else fail(r.reason);
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6 backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="w-full max-w-md rounded-[2rem] bg-paper p-8 shadow-[var(--shadow-pop)]" role="dialog" aria-modal="true">
        <h2 className="text-center font-display text-3xl font-bold text-ink">🔒 {mode === "pin" ? tr("unlock.pinTitle") : tr("unlock.title")}</h2>

        {mode === "loading" ? <p className="mt-8 text-center text-ink-soft">…</p> : null}

        {mode === "pin" ? (
          <div className="mt-6">
            {parents.length > 1 ? (
              <div className="mb-4 flex justify-center gap-2">
                {parents.map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => setWho(p)}
                    className={`min-h-12 rounded-full px-5 font-bold ${who?.userId === p.userId ? "bg-maple text-white" : "bg-card text-ink ring-1 ring-line"}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mb-5 flex justify-center gap-3" aria-label="PIN">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={`h-5 w-5 rounded-full ${i < pin.length ? "bg-ink" : "bg-line"}`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <PadKey key={d} label={d} onClick={() => pressDigit(d)} />
              ))}
              <PadKey label="⌫" onClick={() => setPin((p) => p.slice(0, -1))} />
              <PadKey label="0" onClick={() => pressDigit("0")} />
              <PadKey label="✓" primary disabled={pin.length < 4 || pending} onClick={submitPin} />
            </div>
            <button type="button" onClick={() => setMode("password")} className="mt-5 min-h-12 w-full font-bold text-maple">
              {tr("unlock.usePassword")}
            </button>
          </div>
        ) : null}

        {mode === "password" ? (
          <form onSubmit={submitPassword} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1 font-bold text-ink">
              {tr("unlock.email")}
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-14 rounded-2xl border border-line bg-card px-4 text-lg font-semibold"
              />
            </label>
            <label className="flex flex-col gap-1 font-bold text-ink">
              {tr("unlock.password")}
              <input
                type="password"
                autoComplete="current-password"
                required
                autoFocus={Boolean(email)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-14 rounded-2xl border border-line bg-card px-4 text-lg font-semibold"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="min-h-16 rounded-2xl bg-maple text-xl font-black text-white disabled:opacity-60"
            >
              {tr("unlock.submit")}
            </button>
            {parents.length > 0 ? (
              <button type="button" onClick={() => setMode("pin")} className="min-h-12 font-bold text-maple">
                {tr("unlock.usePin")}
              </button>
            ) : null}
          </form>
        ) : null}

        {error ? <p className="mt-4 text-center font-bold text-danger" role="alert">{error}</p> : null}

        <button type="button" onClick={onClose} className="mt-4 min-h-12 w-full rounded-2xl font-bold text-ink-soft">
          {tr("unlock.cancel")}
        </button>
      </div>
    </motion.div>
  );
}

function PadKey({
  label,
  onClick,
  primary,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-16 rounded-2xl text-3xl font-black active:scale-95 disabled:opacity-40 ${
        primary ? "bg-moss text-white" : "bg-card text-ink ring-1 ring-line"
      }`}
    >
      {label}
    </button>
  );
}
