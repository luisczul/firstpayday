import { requireParent } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import { SettingsNav } from "./SettingsNav";
import { GeneralSettings } from "./GeneralSettings";

export async function generateMetadata() {
  const ctx = await requireParent();
  return { title: parentT(ctx.locale)("b.common.settings") };
}

export default async function SettingsPage() {
  const ctx = await requireParent();
  // PIN presence only (the hash itself is never readable through the API).
  const { data: me } = await createAdminClient()
    .from("household_members")
    .select("pin_hash, review_emails_enabled, weekly_report_enabled")
    .eq("household_id", ctx.household.id)
    .eq("user_id", ctx.user.id)
    .single();
  const { count: parents } = await ctx.supabase.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", ctx.household.id);
  const h = ctx.household;
  return (
    <>
      <PageHeader title={parentT(ctx.locale)("b.common.settings")} />
      <SettingsNav active="/admin/settings" locale={ctx.locale} />
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
          weekly_report_dow: h.weekly_report_dow,
          weekly_report_hour: h.weekly_report_hour,
        }}
        displayName={ctx.membership.display_name ?? ""}
        email={ctx.user.email}
        hasPin={Boolean(me?.pin_hash)}
        reviewEmails={me?.review_emails_enabled ?? true}
        weeklyReport={me?.weekly_report_enabled ?? true}
        isOwner={ctx.isOwner}
        sharedHome={(parents ?? 1) > 1}
        readOnly={ctx.access !== "full"}
        canMatch
        canTheme
        familyTax={{ enabled: h.tax_enabled, percent: h.tax_percent }}
      />
    </>
  );
}
