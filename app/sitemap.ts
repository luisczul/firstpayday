import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
import { SEO_PAGES } from "./(marketing)/guides/pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    ...SEO_PAGES.map((p) => ({ url: `${base}/${p.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${base}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
