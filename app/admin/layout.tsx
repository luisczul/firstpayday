import { cookies, headers } from "next/headers";
import { isNativeApp } from "@/lib/app/nativeApp";
import { requireParent } from "@/lib/auth/session";
import { ADMIN_MODE_COOKIE, KIOSK_COOKIE, readAdminMode } from "@/lib/auth/adminMode";
import { trialDaysLeft } from "@/lib/billing/access";
import { billingEnabled } from "@/lib/billing/plans";
import { AdminShell } from "@/components/admin/AdminShell";
import { platformShortcut } from "@/lib/auth/platform";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireParent();
  const store = await cookies();
  const onKiosk = Boolean(store.get(KIOSK_COOKIE)?.value);
  // Inside the parent app the native tab bar owns navigation (the kids' tablet keeps the web chrome).
  const embedded = !onKiosk && isNativeApp((await headers()).get("user-agent"));
  const claim = onKiosk ? await readAdminMode(store.get(ADMIN_MODE_COOKIE)?.value) : null;
  const [{ count }, platformHref] = await Promise.all([
    ctx.supabase.from("submissions").select("id", { count: "exact", head: true }).eq("household_id", ctx.household.id).eq("status", "pending"),
    platformShortcut(),
  ]);

  return (
    <AdminShell
      householdId={ctx.household.id}
      householdName={ctx.household.name}
      locale={ctx.locale}
      pendingCount={count ?? 0}
      onKiosk={onKiosk}
      adminTimeoutMinutes={claim?.timeoutMinutes ?? ctx.household.admin_timeout_minutes}
      readOnly={ctx.access !== "full"}
      isOwner={ctx.isOwner}
      trialDaysLeft={billingEnabled() && ctx.subscription?.plan === "trial" ? trialDaysLeft(ctx.subscription, new Date()) : null}
      theme={ctx.household.theme}
      platformHref={platformHref}
      embedded={embedded}
    >
      {children}
    </AdminShell>
  );
}
