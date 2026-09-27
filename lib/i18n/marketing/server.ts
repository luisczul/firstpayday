import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { brand } from "@/lib/brand";
import { LANG_HEADER, hreflangAlternates, isSiteLang, localePath, type SiteLang } from "./routes";
import { marketing } from "./index";

/** The public-site language for this request (set by middleware from the /fr|/es|/pt prefix or ?lang=). */
export async function getSiteLang(): Promise<SiteLang> {
  const value = (await headers()).get(LANG_HEADER);
  return isSiteLang(value) ? value : "en";
}

/**
 * Full metadata for a public page: localized title/description, canonical,
 * hreflang alternates (en, fr, es, pt, x-default) and a localized Open Graph card.
 * `path` is the English path ("/", "/terms", "/chore-chart-app").
 */
export function publicMetadata(
  lang: SiteLang,
  path: string,
  { title, description, absoluteTitle = false }: { title: string; description: string; absoluteTitle?: boolean },
): Metadata {
  const m = marketing(lang);
  const url = localePath(lang, path);
  const image = { url: `/og/${lang}`, width: 1200, height: 630, alt: m.meta.ogAlt };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: hreflangAlternates(path) },
    openGraph: {
      type: "website",
      siteName: brand.name,
      locale: m.ogLocale,
      alternateLocale: (["en", "fr", "es", "pt"] as const).filter((l) => l !== lang).map((l) => marketing(l).ogLocale),
      url,
      title,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}
