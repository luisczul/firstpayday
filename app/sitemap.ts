import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
import { billingEnabled } from "@/lib/billing/plans";
import { GUIDE_SLUGS, SITE_LANGS, authHref, localePath } from "@/lib/i18n/marketing/routes";

type Entry = MetadataRoute.Sitemap[number];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const now = new Date();
  const pages: { path: string; changeFrequency: Entry["changeFrequency"]; priority: number; auth?: boolean }[] = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    ...(billingEnabled() ? [{ path: "/pricing", changeFrequency: "monthly" as const, priority: 0.9 }] : []),
    ...GUIDE_SLUGS.map((s) => ({ path: `/${s}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { path: "/signup", changeFrequency: "yearly", priority: 0.6, auth: true },
    { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  ];
  // Every language version is listed, each carrying the full hreflang set.
  return pages.flatMap(({ path, changeFrequency, priority, auth }) => {
    const href = (l: (typeof SITE_LANGS)[number]) => `${base}${auth ? authHref(l, path) : localePath(l, path)}`;
    const languages = Object.fromEntries(SITE_LANGS.map((l) => [l, href(l)]));
    return SITE_LANGS.map((l) => ({
      url: href(l),
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages: { ...languages, "x-default": href("en") } },
    }));
  });
}
