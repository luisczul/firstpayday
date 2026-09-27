import type { Metadata } from "next";
import { SITE_LANGS, authHref, type SiteLang } from "@/lib/i18n/marketing";

/** Title, canonical and hreflang (?lang=) for an auth page. */
export function authMetadata(lang: SiteLang, path: string, title: string): Metadata {
  const languages: Record<string, string> = Object.fromEntries(SITE_LANGS.map((l) => [l, authHref(l, path)]));
  languages["x-default"] = path;
  return { title, alternates: { canonical: authHref(lang, path), languages }, openGraph: { url: authHref(lang, path), title } };
}
