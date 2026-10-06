import { z } from "zod";
import { authCopy } from "@/lib/i18n/authCopy";
import { trackActivity } from "@/lib/slack/activity";
import { appLocale, appMessage, body, fail, ok, sessionJson, statelessClient } from "@/lib/app/api";

export async function POST(req: Request) {
  const m = authCopy(appLocale(req));
  const parsed = z.object({ email: z.email(), password: z.string().min(1).max(200) }).safeParse(await body(req));
  if (!parsed.success) return fail("invalid", m("checkForm"), 400);
  const { data, error } = await statelessClient().auth.signInWithPassword(parsed.data);
  if (error || !data.session) {
    if (error && /not confirmed/i.test(error.message)) return fail("email_not_confirmed", appMessage(req, "emailNotConfirmed"), 403);
    if (error?.status === 429) return fail("rate_limited", appMessage(req, "server"), 429);
    return fail("invalid_credentials", m("noMatch"), 401);
  }
  trackActivity({ kind: "login", email: data.user?.email });
  return ok(sessionJson(data.session));
}
