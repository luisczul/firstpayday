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
