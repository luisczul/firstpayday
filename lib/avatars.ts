import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Signed URLs for private avatars (SPEC §13: signed URLs preferred). */
export async function signedAvatarMap(
  client: SupabaseClient,
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (wanted.length === 0) return {};
  const { data } = await client.storage.from("avatars").createSignedUrls(wanted, 60 * 60);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
