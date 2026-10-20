import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Unused, unexpired invites for this email, with the inviting home's name (server-side only). */
export async function pendingInvitesFor(email: string) {
  const { data } = await createAdminClient()
    .from("household_invites")
    .select("id, email, role, expires_at, households(name)")
    .ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString());
  return (data ?? []).map((i) => ({ id: i.id, role: i.role, home: (i.households as { name: string } | null)?.name ?? "" }));
}
