/** Cartoon avatars a parent can pick instead of a photo (stored as avatar_path "preset:<id>"). */
export const AVATAR_PRESETS = [
  { id: "fox", emoji: "🦊", bg: "#F6C99B" },
  { id: "panda", emoji: "🐼", bg: "#CFE3D4" },
  { id: "frog", emoji: "🐸", bg: "#C8E6A0" },
  { id: "lion", emoji: "🦁", bg: "#F7D774" },
  { id: "tiger", emoji: "🐯", bg: "#F9B97A" },
  { id: "koala", emoji: "🐨", bg: "#D5D9E6" },
  { id: "monkey", emoji: "🐵", bg: "#E4C3A1" },
  { id: "unicorn", emoji: "🦄", bg: "#EBC7F0" },
  { id: "puppy", emoji: "🐶", bg: "#F3DDB8" },
  { id: "kitten", emoji: "🐱", bg: "#FBE0A6" },
  { id: "bunny", emoji: "🐰", bg: "#F8D3DE" },
  { id: "dino", emoji: "🦖", bg: "#B9E2DA" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];
export const PRESET_PREFIX = "preset:";

export function presetFromPath(path: string | null | undefined) {
  if (!path?.startsWith(PRESET_PREFIX)) return null;
  const id = path.slice(PRESET_PREFIX.length);
  return AVATAR_PRESETS.find((p) => p.id === id) ?? null;
}

export function isPresetId(id: string): id is AvatarPresetId {
  return AVATAR_PRESETS.some((p) => p.id === id);
}

/** Buddy names for screen readers, in the parent's language. */
export const PRESET_NAMES: Record<AvatarPresetId, Record<"en" | "fr" | "es" | "pt", string>> = {
  fox: { en: "Fox", fr: "Renard", es: "Zorro", pt: "Raposa" },
  panda: { en: "Panda", fr: "Panda", es: "Panda", pt: "Panda" },
  frog: { en: "Frog", fr: "Grenouille", es: "Rana", pt: "Sapo" },
  lion: { en: "Lion", fr: "Lion", es: "León", pt: "Leão" },
  tiger: { en: "Tiger", fr: "Tigre", es: "Tigre", pt: "Tigre" },
  koala: { en: "Koala", fr: "Koala", es: "Koala", pt: "Coala" },
  monkey: { en: "Monkey", fr: "Singe", es: "Mono", pt: "Macaco" },
  unicorn: { en: "Unicorn", fr: "Licorne", es: "Unicornio", pt: "Unicórnio" },
  puppy: { en: "Puppy", fr: "Chiot", es: "Perrito", pt: "Cachorrinho" },
  kitten: { en: "Kitten", fr: "Chaton", es: "Gatito", pt: "Gatinho" },
  bunny: { en: "Bunny", fr: "Lapin", es: "Conejito", pt: "Coelhinho" },
  dino: { en: "Dinosaur", fr: "Dinosaure", es: "Dinosaurio", pt: "Dinossauro" },
};
