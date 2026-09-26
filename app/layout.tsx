import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { brand } from "@/lib/brand";
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
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
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
