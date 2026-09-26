"use client";

import { AnimatePresence, motion } from "framer-motion";

export function KidToast({ message, tone = "happy" }: { message: string | null; tone?: "happy" | "sad" }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {message ? (
          <motion.div
            key={message}
            initial={{ y: 40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className={`rounded-full px-8 py-4 text-2xl font-extrabold text-white shadow-[var(--shadow-pop)] ${
              tone === "happy" ? "bg-moss" : "bg-plum"
            }`}
          >
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
