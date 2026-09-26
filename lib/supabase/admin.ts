import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicEnv, requireEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so every query MUST be filtered by a
 * household_id that the server resolved itself (kiosk token, verified
 * membership, or Stripe webhook metadata). Never import from client code.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
