import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRESET_PREFIX } from "@/lib/avatarPresets";

/** Signed URLs for private avatars (SPEC §13: signed URLs preferred). */
export async function signedAvatarMap(
  client: SupabaseClient,
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const all = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const out: Record<string, string> = {};
  // Cartoon avatars aren't files: pass them through for <KidAvatar>.
  for (const p of all) if (p.startsWith(PRESET_PREFIX)) out[p] = p;
  const wanted = all.filter((p) => !p.startsWith(PRESET_PREFIX));
  if (wanted.length === 0) return out;
  const { data } = await client.storage.from("avatars").createSignedUrls(wanted, 60 * 60);
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
