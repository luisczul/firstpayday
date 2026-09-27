import { resolveKiosk } from "@/lib/kiosk/auth";
import { listKids } from "@/lib/kiosk/operations";
import { headers } from "next/headers";
import { localeFromBrowser, t } from "@/lib/i18n";
import { KidPicker } from "./KidPicker";
import { KioskMessage } from "./KioskMessage";

export const dynamic = "force-dynamic";

export default async function KidsPickerPage() {
  const kiosk = await resolveKiosk();
  if (kiosk.status !== "ok") {
    // No household yet on this device, so follow the browser's language.
    const locale = localeFromBrowser((await headers()).get("accept-language"));
    if (kiosk.status === "revoked") return <KioskMessage emoji="🔌" locale={locale} message={t(locale, "kid.disconnected")} />;
    return <KioskMessage emoji="📱" locale={locale} message={t(locale, "kid.notSetUp")} />;
  }
  const initial = await listKids(kiosk.ctx);
  return <KidPicker initial={initial} />;
}
