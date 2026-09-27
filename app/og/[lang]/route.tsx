import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { isSiteLang, marketing } from "@/lib/i18n/marketing";

// No emoji: Satori fetches emoji glyphs at render time, which crashes the dev server.
// Open Graph card per language: /og/en, /og/fr, /og/es, /og/pt (referenced from page metadata).
const size = { width: 1200, height: 630 };

export async function GET(_: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = isSiteLang(raw) ? raw : "en";
  const m = marketing(lang);
  const colors = ["#B8431F", "#E08A1E", "#7A3B4A"];
  const cards = [
    [m.hero.cards[0], `${m.money(2)} ${m.hero.perFloor}`],
    [m.hero.cards[1], m.money(2)],
    [m.hero.cards[2], m.money(2)],
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FBF3E4", padding: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#B8431F", fontSize: 40, fontWeight: 800 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#B8431F", color: "#F2C14E", display: "flex", alignItems: "center", justifyContent: "center" }}>$</div>
          {brand.name}
        </div>
        <div style={{ marginTop: 36, fontSize: 72, fontWeight: 900, color: "#3B2418", lineHeight: 1.05, display: "flex" }}>
          {`${m.hero.h1Start} ${m.hero.h1Accent}`}
        </div>
        <div style={{ marginTop: 16, fontSize: 32, color: "#7A5A48", display: "flex" }}>{m.meta.ogTagline}</div>
        <div style={{ marginTop: 32, display: "flex", gap: 24 }}>
          {cards.map(([title, price], i) => (
            <div key={title} style={{ display: "flex", flexDirection: "column", width: 330, height: 180, background: "#FFFAF1", borderRadius: 28, borderLeft: `14px solid ${colors[i]}`, padding: 22, position: "relative" }}>
              <div style={{ position: "absolute", right: 18, top: 16, background: "#F2C14E", borderRadius: 99, padding: "6px 14px", fontSize: 24, fontWeight: 900 }}>{price}</div>
              <div style={{ marginTop: 40, fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: "#3B2418", display: "flex" }}>{title}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "public, max-age=86400, immutable" } },
  );
}
