import { requireParent } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { PageHeader } from "@/components/ui";
import { SettingsNav } from "./SettingsNav";
import { GeneralSettings } from "./GeneralSettings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireParent();
  // PIN presence only (the hash itself is never readable through the API).
  const { data: me } = await createAdminClient()
    .from("household_members")
    .select("pin_hash")
    .eq("household_id", ctx.household.id)
    .eq("user_id", ctx.user.id)
    .single();
  const h = ctx.household;
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav active="/admin/settings" />
      <GeneralSettings
        household={{
          name: h.name,
          timezone: h.timezone,
          currency: h.currency,
          locale: ctx.locale,
          week_starts_on: h.week_starts_on,
          admin_timeout_minutes: h.admin_timeout_minutes,
          kid_idle_seconds: h.kid_idle_seconds,
          savings_match_percent: h.savings_match_percent,
          theme: h.theme === "plain" ? "plain" : "fall",
        }}
        displayName={ctx.membership.display_name ?? ""}
        email={ctx.user.email}
        hasPin={Boolean(me?.pin_hash)}
        isOwner={ctx.isOwner}
        readOnly={ctx.access !== "full"}
        canMatch={PLAN_LIMITS[ctx.plan].savingsMatch}
        canTheme={PLAN_LIMITS[ctx.plan].customThemes}
      />
    </>
  );
}
