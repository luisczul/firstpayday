import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/crypto";
import { AuthShell } from "@/app/(auth)/AuthShell";
import { buttonClass } from "@/components/ui";
import { asLocale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";
import { rich } from "@/lib/i18n/parent/rich";
import { AcceptInvite } from "./AcceptInvite";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: invite } = await createAdminClient()
    .from("household_invites")
    .select("id, email, role, expires_at, accepted_at, households(name, locale)")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();

  // The invite speaks the household's language (English when the invite is unknown).
  const household = (invite?.households as { name: string; locale: string | null } | null) ?? null;
  const t = parentT(asLocale(household?.locale));

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return (
      <AuthShell title={t("b.invite.expiredTitle")}>
        <p className="text-ink-soft">{t("b.invite.expiredBody")}</p>
      </AuthShell>
    );
  }

  const householdName = household?.name ?? t("b.invite.aHousehold");
  const role = invite.role === "owner" ? t("b.members.roleOwner") : invite.role === "parent" ? t("b.members.roleParent") : invite.role;
  const { user } = await getUser();
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <AuthShell title={t("b.email.invite.title", { home: householdName })}>
      <p className="mb-5 text-ink-soft">{rich(t("b.invite.invitedAs"), { role: <b>{role}</b>, email: invite.email })}</p>
      {user ? (
        <AcceptInvite
          token={token}
          signedInAs={user.email ?? ""}
          invitedEmail={invite.email}
          t={{
            accept: t("b.email.invite.cta"),
            mismatch: t("b.invite.mismatch", { signedIn: user.email ?? "", invited: invite.email }),
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Link href={`/signup?next=${next}`} className={buttonClass("primary", "lg")}>{t("b.invite.createAccount")}</Link>
          <Link href={`/login?next=${next}`} className={buttonClass("secondary", "lg")}>{t("b.invite.haveAccount")}</Link>
        </div>
      )}
    </AuthShell>
  );
}
