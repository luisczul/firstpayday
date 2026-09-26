import { resolveKiosk } from "@/lib/kiosk/auth";
import { listKids } from "@/lib/kiosk/operations";
import { t } from "@/lib/i18n";
import { KidPicker } from "./KidPicker";
import { KioskMessage } from "./KioskMessage";

export const dynamic = "force-dynamic";

export default async function KidsPickerPage() {
  const kiosk = await resolveKiosk();
  if (kiosk.status === "revoked") return <KioskMessage emoji="🔌" message={t("en", "kid.disconnected")} />;
  if (kiosk.status === "none") return <KioskMessage emoji="📱" message={t("en", "kid.notSetUp")} />;
  const initial = await listKids(kiosk.ctx);
  return <KidPicker initial={initial} />;
}
