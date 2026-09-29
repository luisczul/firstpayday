/**
 * The cartoon coin from the app icon, tossed and bouncing while a page loads (the iOS and
 * Android apps draw the same one). Appears after 150 ms so fast loads don't flash.
 */
export function CoinLoader({ caption, delayed = true }: { caption: string; delayed?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`${delayed ? "coin-loader " : ""}flex flex-col items-center justify-center gap-4 py-16`}>
      <div className="relative h-[110px] w-[110px]">
        <span aria-hidden className="coin-sparkle left-1 top-4">✦</span>
        <span aria-hidden className="coin-sparkle right-0 top-1 [animation-delay:400ms]">✦</span>
        <span aria-hidden className="coin-sparkle bottom-8 right-2 text-[10px] [animation-delay:800ms]">✦</span>
        <div className="coin-toss absolute left-[19px] top-3 h-[72px] w-[72px]">
          <CoinFace />
          <CoinFace back />
        </div>
        <div aria-hidden className="coin-shadow absolute bottom-2 left-[31px] h-2 w-12 rounded-[50%] bg-ink" />
      </div>
      <p className="text-base font-semibold text-ink-soft">{caption}</p>
    </div>
  );
}

function CoinFace({ back = false }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 72 72" aria-hidden className={`coin-face absolute inset-0 ${back ? "coin-face-back" : ""}`}>
      <circle cx="36" cy="36" r="33.5" fill="#F2C14E" stroke="#E08A1E" strokeWidth="5" />
      <circle cx="36" cy="36" r="26" fill="none" stroke="#FBF3E4" strokeWidth="3" />
      <text x="36" y="37" textAnchor="middle" dominantBaseline="central" fontSize="38" fontWeight="900" fill="#7A3B4A" fontFamily="ui-rounded, system-ui, sans-serif">
        $
      </text>
    </svg>
  );
}
