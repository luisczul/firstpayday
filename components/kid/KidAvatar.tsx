/* eslint-disable @next/next/no-img-element -- signed Supabase URLs, sized by CSS */
import { presetFromPath } from "@/lib/avatarPresets";

export function KidAvatar({
  name,
  color,
  avatarUrl,
  size = 160,
  ring = true,
}: {
  name: string;
  color: string;
  avatarUrl: string | null;
  size?: number;
  ring?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const preset = presetFromPath(avatarUrl);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: preset ? preset.bg : color,
        boxShadow: ring ? `0 0 0 ${Math.max(3, size / 28)}px #fffaf1, 0 0 0 ${Math.max(6, size / 14)}px ${color}` : undefined,
      }}
      aria-hidden
    >
      {preset ? (
        <span style={{ fontSize: size * 0.62, lineHeight: 1 }}>{preset.emoji}</span>
      ) : avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="font-display font-extrabold text-white" style={{ fontSize: size * 0.46, lineHeight: 1 }}>
          {initial}
        </span>
      )}
    </span>
  );
}
