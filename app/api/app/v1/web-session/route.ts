import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadParentContext } from "@/lib/auth/session";
import { ADMIN_MODE_COOKIE } from "@/lib/auth/adminMode";
import { withinLimit } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { statelessClient } from "@/lib/app/api";
import { clearKioskCookie, registerKioskDevice } from "@/lib/kiosk/auth";
import { parentT } from "@/lib/i18n/parent";

/**
 * The native apps' web views start here (docs/native/app-api.md): a form POST with the app's access
 * token signs this web view in with its own web session (cookies), then 303 → `next`. With mode=kiosk it turns the device into the
 * kids' tablet, exactly like the web's "Kids Mode" button.
 */
export async function POST(req: Request) {
  // A web view's own navigation is "none"/"same-origin"; refuse forms posted from other sites.
  if (req.headers.get("sec-fetch-site") === "cross-site") return new NextResponse("Forbidden", { status: 403 });
  const form = await req.formData().catch(() => null);
  const field = (k: string) => {
    const v = form?.get(k);
    return typeof v === "string" ? v : "";
  };
  const nextRaw = field("next");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\") ? nextRaw : "/admin";
  // Relative Location: the web view stays on whatever host it used (an absolute URL built from
  // req.url can name a different host behind proxies, and the app would open it in a browser).
  const go = (path: string) => new NextResponse(null, { status: 303, headers: { Location: path, "cache-control": "no-store" } });

  const token = z.string().min(1).max(8192).safeParse(field("access_token"));
  if (!token.success) return go(`/login?next=${encodeURIComponent(next)}`);
  // Prove who the app's token belongs to, then give this web view its OWN session: sharing the app's
  // refresh token would let one side's refresh revoke the other's (Supabase refresh-token rotation).
  const { data: who } = await statelessClient(token.data).auth.getUser(token.data);
  if (!who.user?.email) return go(`/login?next=${encodeURIComponent(next)}`);
  const { data: link, error: linkError } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email: who.user.email });
  if (linkError || !link.properties?.hashed_token) return go(`/login?next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (error || !data.user || data.user.id !== who.user.id) return go(`/login?next=${encodeURIComponent(next)}`);

  if (field("mode") !== "kiosk") return go(next);

  const ctx = await loadParentContext(supabase, data.user);
  if (!ctx) return go("/onboarding/home");
  const { count } = await ctx.supabase.from("devices").select("id", { count: "exact", head: true }).eq("household_id", ctx.household.id).is("revoked_at", null);
  if (!withinLimit("devices", count ?? 0)) return go("/admin/settings");
  await clearKioskCookie();
  await registerKioskDevice({ householdId: ctx.household.id, userId: ctx.user.id, name: parentT(ctx.locale)("b.devices.defaultName") });
  // The tablet belongs to the kids now: sign the parent out of this web view (the app forgets its tokens too).
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(ADMIN_MODE_COOKIE);
  return go("/kids");
}
