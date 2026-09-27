import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { brand } from "@/lib/brand";
import { appUrl } from "@/lib/env";
import { marketing } from "@/lib/i18n/marketing";
import { getSiteLang } from "@/lib/i18n/marketing/server";
import "./globals.css";

// Self-hosted variable fonts (SIL Open Font License): no third-party requests at runtime or build.
const fraunces = localFont({
  src: "./fonts/Fraunces-latin.woff2",
  variable: "--font-fraunces",
  weight: "600 800",
  display: "swap",
  fallback: ["Georgia", "serif"],
});
const nunito = localFont({
  src: "./fonts/Nunito-latin.woff2",
  variable: "--font-nunito",
  weight: "400 900",
  display: "swap",
  fallback: ["ui-rounded", "system-ui", "sans-serif"],
});

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  const m = marketing(lang);
  const image = { url: `/og/${lang}`, width: 1200, height: 630, alt: m.meta.ogAlt };
  return {
    metadataBase: new URL(appUrl()),
    title: { default: m.meta.siteTitle, template: `%s · ${brand.name}` },
    description: m.meta.siteDescription,
    keywords: m.meta.keywords,
    openGraph: { type: "website", siteName: brand.name, locale: m.ogLocale, images: [image] },
    twitter: { card: "summary_large_image", images: [image.url] },
    applicationName: brand.name,
    appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
    icons: { icon: "/icons/192", apple: "/icons/180" },
  };
}

export const viewport: Viewport = {
  themeColor: "#FBF3E4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request language (middleware): /fr, /es, /pt public pages and ?lang= auth pages.
  const lang = await getSiteLang();
  return (
    <html lang={lang} data-theme="fall" className={`${fraunces.variable} ${nunito.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
