import "server-only";
import { cookies, headers } from "next/headers";
import { getParentContext } from "@/lib/auth/session";
import { isLocale, localeFromBrowser, type Locale } from "@/lib/i18n";
import { SIGNUP_LANG_COOKIE } from "@/lib/i18n/marketing/routes";

/**
 * Onboarding language: the household's once it exists, else the language the parent
 * signed up in (/signup?lang=… cookie), else the browser's.
 */
export async function onboardingLocale(): Promise<Locale> {
  const ctx = await getParentContext();
  if (ctx) return ctx.locale;
  const signup = (await cookies()).get(SIGNUP_LANG_COOKIE)?.value;
  if (isLocale(signup)) return signup;
  return localeFromBrowser((await headers()).get("accept-language")?.split(",")[0]);
}
