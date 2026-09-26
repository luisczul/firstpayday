"use client";

/* eslint-disable @next/next/no-img-element -- local object URLs */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Center-crop to a square and export ≤512px WebP (JPEG where WebP encoding is missing). */
export async function cropToSquare(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
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
  onChange: (blob: Blob | null) => void;
  size?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const blob = await cropToSquare(file);
    setPreview(URL.createObjectURL(blob));
    onChange(blob);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative flex items-center justify-center overflow-hidden rounded-full ring-4 ring-card"
        style={{ width: size, height: size, background: color }}
        aria-label="Choose a photo"
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-3xl font-bold text-white">{name.trim().charAt(0).toUpperCase() || "📷"}</span>
        )}
        <span className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full bg-card text-sm shadow">📷</span>
      </button>
      {preview ? (
        <button
          type="button"
          className="text-xs font-bold text-ink-soft"
          onClick={() => {
            setPreview(null);
            onChange(null);
          }}
        >
          Remove photo
        </button>
      ) : null}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
