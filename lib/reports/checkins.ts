import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KioskContext } from "@/lib/kiosk/auth";

/**
 * One row per board open from the kiosk picker. Called via `after()` so the
 * kid never waits on it; never throws.
 */
export async function recordCheckin(ctx: KioskContext, kidId: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("kid_checkins")
      .insert({ household_id: ctx.householdId, kid_id: kidId, device_id: ctx.deviceId });
    if (error) console.error("check-in not recorded", error.message);
  } catch (e) {
    console.error("check-in not recorded", e instanceof Error ? e.message : e);
  }
}
