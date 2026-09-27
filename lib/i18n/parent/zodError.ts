import type { Locale } from "@/lib/i18n";
import { parentT, type ParentKey } from "./index";

/**
 * Server actions put dictionary keys (e.g. "b.err.choreTitle") in their zod messages;
 * this turns the first issue into the parent's language, or a generic "Check the form."
 */
export function zodErrorMessage(locale: Locale, issues: { message: string }[], vars?: Record<string, string | number>): string {
  const t = parentT(locale);
  const m = issues[0]?.message;
  return m && /^[abc]\.[\w.]+$/.test(m) ? t(m as ParentKey, vars) : t("b.err.checkForm");
}
