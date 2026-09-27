import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { hasKioskCookie } from "@/lib/kiosk/auth";
import { marketing } from "@/lib/i18n/marketing";
import { getSiteLang, publicMetadata } from "@/lib/i18n/marketing/server";
import { Landing } from "./(marketing)/Landing";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  const m = marketing(lang).meta;
  return publicMetadata(lang, "/", { title: m.homeTitle, description: m.homeDescription, absoluteTitle: true });
}

// Root routing (SPEC §11): kiosk → /kids, parent → /admin, else the landing page.
// Also serves /fr, /es and /pt (middleware rewrite + language header).
export default async function Root() {
  const { user } = await getUser();
  if (user) redirect("/admin");
  if (await hasKioskCookie()) redirect("/kids");
  return <Landing lang={await getSiteLang()} />;
}
