import { requireParent } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS } from "@/lib/billing/plans";
import { PageHeader } from "@/components/ui";
import { SettingsNav } from "../SettingsNav";
import { MembersList } from "./MembersList";

export const metadata = { title: "Parents" };

export default async function MembersPage() {
  const ctx = await requireParent();
  const admin = createAdminClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    ctx.supabase.from("household_members").select("user_id, role, display_name, created_at").eq("household_id", ctx.household.id),
    ctx.isOwner
      ? ctx.supabase.from("household_invites").select("id, email, role, expires_at, accepted_at").eq("household_id", ctx.household.id).is("accepted_at", null)
      : Promise.resolve({ data: [] as { id: string; email: string; role: string; expires_at: string; accepted_at: string | null }[] }),
  ]);
  // Member emails come from auth.users (server-side only).
  const withEmail = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { ...m, email: data.user?.email ?? "" };
    }),
  );
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav active="/admin/settings/members" />
      <MembersList
        members={withEmail}
        invites={(invites ?? []).filter((i) => new Date(i.expires_at) > new Date())}
        meId={ctx.user.id}
        isOwner={ctx.isOwner}
        limit={LIMITS.parents}
      />
    </>
  );
}
