import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/kids", "/api", "/platform", "/onboarding", "/invite", "/auth"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
