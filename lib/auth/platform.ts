import "server-only";
import { notFound } from "next/navigation";
import { getUser } from "./session";
import { createAdminClient } from "@/lib/supabase/admin";

/** Platform owner console gate (SPEC §20). 404 for everyone else. */
export async function requirePlatformAdmin(): Promise<{ userId: string; email: string }> {
  const { user } = await getUser();
  if (!user) notFound();
  const { data } = await createAdminClient().from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) notFound();
  return { userId: user.id, email: user.email ?? "" };
}

/** The one owner account that gets a shortcut to the control panel inside the parent admin. */
const OWNER_EMAIL = "luisczul@gmail.com";

/**
 * The control panel link for the owner, or null for everyone else. Both checks must pass: the
 * owner's email and a platform_admins row. The link is decided on the server, so no one else's
 * page ever contains it.
 */
export async function platformShortcut(): Promise<string | null> {
  const { user } = await getUser();
  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) return null;
  const { data } = await createAdminClient().from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? "/platform" : null;
}
