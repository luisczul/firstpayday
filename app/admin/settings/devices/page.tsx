import { cookies } from "next/headers";
import { requireParent } from "@/lib/auth/session";
import { LIMITS } from "@/lib/billing/plans";
import { KIOSK_COOKIE } from "@/lib/auth/adminMode";
import { PageHeader } from "@/components/ui";
import { SettingsNav } from "../SettingsNav";
import { DevicesList } from "./DevicesList";

export const metadata = { title: "Tablets" };

export default async function DevicesPage() {
  const ctx = await requireParent();
  const { data: devices } = await ctx.supabase
    .from("devices")
    .select("id, name, last_seen_at, revoked_at, created_at")
    .eq("household_id", ctx.household.id)
    .order("created_at", { ascending: false });
  const onKiosk = Boolean((await cookies()).get(KIOSK_COOKIE)?.value);
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav active="/admin/settings/devices" />
      <DevicesList
        devices={devices ?? []}
        limit={LIMITS.devices}
        onKiosk={onKiosk}
        locale={ctx.locale}
      />
    </>
  );
}
