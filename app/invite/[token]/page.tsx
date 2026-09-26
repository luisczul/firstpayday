import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/crypto";
import { AuthShell } from "@/app/(auth)/AuthShell";
import { buttonClass } from "@/components/ui";
import { AcceptInvite } from "./AcceptInvite";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: invite } = await createAdminClient()
    .from("household_invites")
    .select("id, email, role, expires_at, accepted_at, households(name)")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return (
      <AuthShell title="This invite has expired">
        <p className="text-ink-soft">Ask the person who invited you to send a new one.</p>
      </AuthShell>
    );
  }

  const householdName = (invite.households as { name: string } | null)?.name ?? "a household";
  const { user } = await getUser();
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <AuthShell title={`Join ${householdName}`}>
      <p className="mb-5 text-ink-soft">
        You&apos;ve been invited as a <b>{invite.role}</b> ({invite.email}).
      </p>
      {user ? (
        <AcceptInvite token={token} signedInAs={user.email ?? ""} invitedEmail={invite.email} />
      ) : (
        <div className="flex flex-col gap-3">
          <Link href={`/signup?next=${next}`} className={buttonClass("primary", "lg")}>Create an account</Link>
          <Link href={`/login?next=${next}`} className={buttonClass("secondary", "lg")}>I already have an account</Link>
        </div>
      )}
    </AuthShell>
  );
}
