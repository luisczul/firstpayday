import Link from "next/link";

/** Full-screen friendly message for a tablet that isn't (or is no longer) a kiosk. */
export function KioskMessage({ emoji, message, showLogin = true }: { emoji: string; message: string; showLogin?: boolean }) {
  return (
    <main className="kiosk paper-texture flex flex-col items-center justify-center gap-8 p-10 text-center">
      <span className="text-8xl" aria-hidden>{emoji}</span>
      <p className="max-w-xl font-display text-4xl font-bold text-ink">{message}</p>
      {showLogin ? (
        <Link href="/login" className="rounded-full bg-maple px-8 py-4 text-xl font-black text-white">
          Parent log in
        </Link>
      ) : null}
    </main>
  );
}
