import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

/** Full-screen friendly message for a tablet that isn't (or is no longer) a kiosk. */
export function KioskMessage({
  emoji,
  message,
  locale = "en",
  showLogin = true,
}: {
  emoji: string;
  message: string;
  locale?: Locale;
  showLogin?: boolean;
}) {
  return (
    <main className="kiosk paper-texture flex flex-col items-center justify-center gap-8 p-10 text-center">
      <span className="text-8xl" aria-hidden>{emoji}</span>
      <p className="max-w-xl font-display text-4xl font-bold text-ink">{message}</p>
      {showLogin ? (
        <Link href="/login" className="rounded-full bg-maple px-8 py-4 text-xl font-black text-white">
          {t(locale, "kid.parentLogin")}
        </Link>
      ) : null}
    </main>
  );
}
