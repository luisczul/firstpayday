/**
 * Grant platform-owner access (SPEC §10):  pnpm tsx scripts/make-platform-admin.ts you@example.com
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment / .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();
const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.error("Usage: pnpm tsx scripts/make-platform-admin.ts <email>");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) {
      const { error: insError } = await admin.from("platform_admins").upsert({ user_id: user.id });
      if (insError) throw insError;
      console.log(`✓ ${email} is now a platform admin. Open /platform.`);
      return;
    }
    if (data.users.length < 200) break;
  }
  console.error(`No account with email ${email}. Sign up first.`);
  process.exit(1);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
