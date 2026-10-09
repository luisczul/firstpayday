/**
 * Each card icon has its own stripe color, so parents only pick the icon.
 * Keys are stored without the U+FE0F variation selector.
 */
export const EMOJI_COLORS: Record<string, string> = {
  "⭐": "#E08A1E", // amber
  "🧹": "#B8431F", // maple
  "🧽": "#2F8F9D", // teal
  "🧺": "#8A5A9E", // lavender
  "🗑": "#5E6B3A", // olive
  "🚗": "#C0392B", // red
  "🍽": "#D4A017", // mustard
  "🛁": "#3A7CA5", // blue
  "🪴": "#3C8D6E", // green
  "🍖": "#A0522D", // sienna
  "🪑": "#8B6B4A", // walnut
  "👟": "#D2691E", // orange
  "🧸": "#C9962B", // honey
  "🧥": "#7A3B4A", // plum
  "💡": "#E0B400", // yellow
  "🐶": "#9C6644", // brown
  "📚": "#4B5FA8", // indigo
  "🛏": "#6C7FB0", // slate blue
  "🪟": "#4FA3C7", // sky
  "❄": "#5AA9D6", // ice
  "🍂": "#C4571A", // rust
  "👩‍🍳": "#D9534F", // tomato
  "🏕": "#6B7A2E", // moss
  "🔋": "#2E9E5B", // battery green
  "🔧": "#5B6770", // steel
  "🔨": "#9B5B2E", // hammer brown
  "🪛": "#D97B29", // screwdriver orange
  "🛠": "#4A5A6A", // gunmetal
  "🔐": "#B8862B", // brass
  "🧯": "#C8302A", // extinguisher red
  "🪜": "#A27A4E", // ladder wood
};

const DEFAULT = "#E08A1E";

/** The stripe color for an icon (unknown/custom icons get a stable color from the palette). */
export function emojiColor(emoji: string | null | undefined): string | null {
  if (!emoji) return null;
  const key = emoji.replace(/️/g, "").trim();
  if (EMOJI_COLORS[key]) return EMOJI_COLORS[key]!;
  const palette = Object.values(EMOJI_COLORS);
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return palette[h % palette.length] ?? DEFAULT;
}
