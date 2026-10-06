import { z } from "zod";
import { trackActivity } from "@/lib/slack/activity";
import { appUrl } from "@/lib/env";
import { asLocale } from "@/lib/i18n";
import { authCopy } from "@/lib/i18n/authCopy";
import { appLocale, appMessage, body, fail, ok, sessionJson, statelessClient } from "@/lib/app/api";

export async function POST(req: Request) {
  const m = authCopy(appLocale(req));
  const b = await body(req);
  if (b?.acceptedTerms !== true) return fail("invalid", m("acceptTerms"), 400);
  const parsed = z.object({ email: z.email(), password: z.string().min(8).max(200) }).safeParse(b);
  if (!parsed.success) {
    const short = parsed.error.issues.some((i) => i.path[0] === "password");
    return fail("invalid", short ? m("password8") : m("checkForm"), 400);
  }
  const locale = asLocale(typeof b.locale === "string" ? b.locale : appLocale(req));
  const { data, error } = await statelessClient().auth.signUp({
    ...parsed.data,
    options: {
      // Same as the web: the confirmation email speaks the parent's language, and its link finishes on the web.
      data: { locale },
      emailRedirectTo: `${appUrl()}/auth/callback?next=/onboarding/home`,
    },
  });
  if (error) {
    if (/already registered|already been registered/i.test(error.message)) return fail("conflict", m("alreadyRegistered"), 409);
    if (error.status === 429) return fail("rate_limited", appMessage(req, "server"), 429);
    return fail("invalid", m("checkForm"), 400);
  }
  // Supabase hides existing accounts behind an empty identities list when confirmation is on.
  if (data.user && data.user.identities?.length === 0) return fail("conflict", m("alreadyRegistered"), 409);
  trackActivity({ kind: "signup", email: parsed.data.email });
  if (!data.session) return ok({ needsConfirmation: true });
  return ok({ needsConfirmation: false, session: sessionJson(data.session) });
}
