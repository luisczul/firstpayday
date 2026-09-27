import { requireParent } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { PageHeader } from "@/components/ui";
import { loadPromotions } from "@/lib/familyPot";
import { instantToZonedDateTime } from "@/lib/schedule/tz";
import { SettingsNav } from "../SettingsNav";
import { PromotionsManager } from "./PromotionsManager";

export async function generateMetadata() {
  const ctx = await requireParent();
  return { title: parentT(ctx.locale)("b.promo.title") };
}

export default async function PromotionsPage() {
  const ctx = await requireParent();
  const tz = ctx.household.timezone;
  const now = new Date();
  const promos = await loadPromotions(ctx.supabase, ctx.household.id, { endedAfter: new Date(now.getTime() - 14 * 86_400_000) });
  const withLocal = promos.map((p) => {
    const s = instantToZonedDateTime(new Date(p.startsAt), tz);
    const e = instantToZonedDateTime(new Date(p.endsAt), tz);
    return { ...p, startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time };
  });
  const start = instantToZonedDateTime(now, tz);
  const end = instantToZonedDateTime(new Date(now.getTime() + 3 * 3_600_000), tz);
  return (
    <>
      <PageHeader title={parentT(ctx.locale)("b.common.settings")} />
      <SettingsNav active="/admin/settings/promotions" locale={ctx.locale} />
      <PromotionsManager
        promotions={withLocal}
        defaults={{ startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time }}
        timezone={tz}
        currency={ctx.household.currency}
        locale={ctx.locale}
        readOnly={ctx.access !== "full"}
        now={now.toISOString()}
      />
    </>
  );
}
