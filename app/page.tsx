import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { hasKioskCookie } from "@/lib/kiosk/auth";
import { Landing } from "./(marketing)/Landing";

// Root routing (SPEC §11): kiosk → /kids, parent → /admin, else the landing page.
export default async function Root() {
  const { user } = await getUser();
  if (user) redirect("/admin");
  if (await hasKioskCookie()) redirect("/kids");
  return <Landing />;
}
