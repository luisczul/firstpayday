import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { brand } from "@/lib/brand";
import { appUrl } from "@/lib/env";
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

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: `${brand.name}: chore chart & allowance app for kids`, template: `%s · ${brand.name}` },
  description:
    "The chore chart that pays your kids. Kids mark paid chores done on the kitchen tablet, you approve from your phone, and their allowance adds up. First kid free.",
  keywords: ["chore chart app", "allowance app for kids", "paid chores", "chore tracker", "kids chores tablet", "allowance tracker", "chores for money"],
  openGraph: { type: "website", siteName: brand.name, locale: "en_CA" },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
};

export const viewport: Viewport = {
  themeColor: "#FBF3E4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="fall" className={`${fraunces.variable} ${nunito.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
