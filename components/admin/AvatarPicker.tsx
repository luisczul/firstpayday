"use client";

/* eslint-disable @next/next/no-img-element -- local object URLs */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setKidAvatar } from "@/app/actions/kids";
import { AVATAR_PRESETS, PRESET_NAMES, PRESET_PREFIX, presetFromPath, type AvatarPresetId } from "@/lib/avatarPresets";
import { useParentLocale, useParentT } from "@/lib/i18n/parent/client";

type Crop = { x: number; y: number; side: number };

/** Crop a square (default: centered) and export ≤512px WebP (JPEG where WebP encoding is missing). */
export async function cropToSquare(file: Blob, size = 512, crop?: Crop): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = crop?.side ?? Math.min(bitmap.width, bitmap.height);
  const sx = crop?.x ?? (bitmap.width - side) / 2;
  const sy = crop?.y ?? (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.max(1, Math.round(Math.min(size, side)));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (blob && blob.type === "image/webp") return blob;
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.88),
  );
}

/** Upload to avatars/{household}/{kid}.webp (RLS: members with write access). */
export async function uploadAvatar(householdId: string, kidId: string, blob: Blob): Promise<boolean> {
  const { error } = await createClient()
    .storage.from("avatars")
    .upload(`${householdId}/${kidId}.webp`, blob, { upsert: true, contentType: blob.type, cacheControl: "3600" });
  return !error;
}

/** What the parent picked: a cropped photo, a cartoon avatar, or nothing (null). */
export type AvatarChoice = Blob | { preset: AvatarPresetId } | null;

/** Persist a choice for a kid (photo upload, cartoon avatar, or removal). */
export async function saveAvatarChoice(householdId: string, kidId: string, choice: AvatarChoice): Promise<void> {
  if (choice instanceof Blob) {
    if (await uploadAvatar(householdId, kidId, choice)) await setKidAvatar(kidId, true);
  } else if (choice) {
    await setKidAvatar(kidId, choice.preset);
  } else {
    await setKidAvatar(kidId, false);
  }
}

export function AvatarPicker({
  name,
  color,
  initialUrl,
  onChange,
  size = 88,
}: {
  name: string;
  color: string;
  initialUrl?: string | null;
  onChange: (choice: AvatarChoice) => void;
  size?: number;
}) {
  const t = useParentT();
  const locale = useParentLocale();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreviewState] = useState<string | null>(initialUrl ?? null);
  const blobUrl = useRef<string | null>(null);
  const setPreview = (next: string | null) => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = next?.startsWith("blob:") ? next : null;
    setPreviewState(next);
  };
  useEffect(() => () => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
  }, []);

  const [choosing, setChoosing] = useState(false);
  const [cropping, setCropping] = useState<File | null>(null);
  const preset = presetFromPath(preview);

  const pick = (file: File | undefined) => {
    if (file) setCropping(file);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => setChoosing(true)}
        className="relative flex items-center justify-center overflow-hidden rounded-full ring-4 ring-card"
        style={{ width: size, height: size, background: preset ? preset.bg : color }}
        aria-label={t("a.avatar.choose")}
      >
        {preset ? (
          <span style={{ fontSize: size * 0.62, lineHeight: 1 }}>{preset.emoji}</span>
        ) : preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-3xl font-bold text-white">{name.trim().charAt(0).toUpperCase() || "🙂"}</span>
        )}
        <span className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full bg-card text-sm shadow">✏️</span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />

      {choosing ? (
        <div role="dialog" aria-modal="true" aria-label={t("a.avatar.choose")} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-[var(--shadow-pop)]">
            <h2 className="font-display text-2xl font-bold text-ink">{name.trim() ? t("a.avatar.chooseFor", { name: name.trim() }) : t("a.avatar.choose")}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t("a.avatar.intro")}</p>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {AVATAR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={PRESET_NAMES[p.id][locale]}
                  aria-pressed={preset?.id === p.id}
                  onClick={() => {
                    setPreview(`${PRESET_PREFIX}${p.id}`);
                    onChange({ preset: p.id });
                    setChoosing(false);
                  }}
                  className={`flex aspect-square items-center justify-center rounded-full text-4xl transition active:scale-95 ${preset?.id === p.id ? "ring-4 ring-maple" : ""}`}
                  style={{ background: p.bg }}
                >
                  {p.emoji}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setChoosing(false);
                  input.current?.click();
                }}
                className="min-h-12 flex-1 rounded-full bg-maple px-4 font-black text-white"
              >
                {t("a.avatar.usePhotoBtn")}
              </button>
              {preview ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    onChange(null);
                    setChoosing(false);
                  }}
                  className="min-h-12 rounded-full bg-paper px-4 font-bold ring-1 ring-line"
                >
                  {t("a.common.remove")}
                </button>
              ) : null}
              <button type="button" onClick={() => setChoosing(false)} className="min-h-12 rounded-full bg-paper px-4 font-bold ring-1 ring-line">
                {t("a.common.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cropping ? (
        <AvatarCropper
          file={cropping}
          onCancel={() => setCropping(null)}
          onDone={(blob) => {
            setCropping(null);
            setPreview(URL.createObjectURL(blob));
            onChange(blob);
          }}
        />
      ) : null}
    </div>
  );
}

const VIEW = 280;

/** Drag to move, slider / pinch / wheel to zoom: pick the face inside the circle. */
function AvatarCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const t = useParentT();
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  // Create and free the object URL in the same effect (safe under React Strict Mode's double run).
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const base = nat ? VIEW / Math.min(nat.w, nat.h) : 1;
  const scale = base * zoom;
  const clamp = (p: { x: number; y: number }, s = scale) =>
    nat
      ? { x: Math.min(0, Math.max(VIEW - nat.w * s, p.x)), y: Math.min(0, Math.max(VIEW - nat.h * s, p.y)) }
      : p;

  const setZoomAround = (z: number) => {
    if (!nat) return;
    const next = Math.min(6, Math.max(1, z));
    const s2 = base * next;
    // Keep the point under the circle's center where it is.
    const cx = (VIEW / 2 - pos.x) / scale;
    const cy = (VIEW / 2 - pos.y) / scale;
    setZoom(next);
    setPos(clamp({ x: VIEW / 2 - cx * s2, y: VIEW / 2 - cy * s2 }, s2));
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomAround((pinch.current.zoom * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / pinch.current.dist);
    } else if (pointers.current.size === 1) {
      setPos((p) => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const save = async () => {
    if (!nat) return;
    setBusy(true);
    try {
      onDone(await cropToSquare(file, 512, { x: -pos.x / scale, y: -pos.y / scale, side: VIEW / scale }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t("a.avatar.adjustAria")} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-[var(--shadow-pop)]">
        <h2 className="font-display text-2xl font-bold text-ink">{t("a.avatar.adjustTitle")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t("a.avatar.adjustIntro")}</p>
        <div
          className="relative mx-auto mt-4 touch-none overflow-hidden rounded-2xl bg-ink select-none"
          style={{ width: VIEW, height: VIEW, cursor: "grab" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => setZoomAround(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))}
        >
          {url ? <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const w = e.currentTarget.naturalWidth;
              const h = e.currentTarget.naturalHeight;
              const s = VIEW / Math.min(w, h);
              setNat({ w, h });
              setPos({ x: (VIEW - w * s) / 2, y: (VIEW - h * s) / 2 });
            }}
            className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
            style={nat ? { width: nat.w * scale, height: nat.h * scale, transform: `translate(${pos.x}px, ${pos.y}px)` } : { opacity: 0 }}
          /> : null}
          {/* Dim everything outside the round avatar. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.45)] ring-2 ring-white/80" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" aria-label={t("a.avatar.zoomOut")} onClick={() => setZoomAround(zoom / 1.2)} className="h-11 w-11 rounded-full bg-paper text-xl font-black ring-1 ring-line">−</button>
          <input
            type="range"
            aria-label={t("a.avatar.zoom")}
            min={1}
            max={6}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomAround(Number(e.target.value))}
            className="flex-1 accent-maple"
          />
          <button type="button" aria-label={t("a.avatar.zoomIn")} onClick={() => setZoomAround(zoom * 1.2)} className="h-11 w-11 rounded-full bg-paper text-xl font-black ring-1 ring-line">+</button>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} className="min-h-12 flex-1 rounded-full bg-paper font-bold ring-1 ring-line">{t("a.common.cancel")}</button>
          <button type="button" disabled={!nat || busy} onClick={() => void save()} className="min-h-12 flex-1 rounded-full bg-maple font-black text-white disabled:opacity-50">
            {busy ? t("a.common.saving") : t("a.avatar.usePhoto")}
          </button>
        </div>
      </div>
    </div>
  );
}
