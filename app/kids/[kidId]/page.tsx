import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveKiosk } from "@/lib/kiosk/auth";
import { getBoard } from "@/lib/kiosk/operations";
import { headers } from "next/headers";
import { localeFromBrowser, t } from "@/lib/i18n";
import { KioskMessage } from "../KioskMessage";
import { KidBoard } from "./KidBoard";

export const dynamic = "force-dynamic";

export default async function KidBoardPage({ params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  if (!z.uuid().safeParse(kidId).success) redirect("/kids");
  const kiosk = await resolveKiosk();
  if (kiosk.status !== "ok") {
    // No household yet on this device, so follow the browser's language.
    const locale = localeFromBrowser((await headers()).get("accept-language"));
    if (kiosk.status === "revoked") return <KioskMessage emoji="🔌" locale={locale} message={t(locale, "kid.disconnected")} />;
    return <KioskMessage emoji="📱" locale={locale} message={t(locale, "kid.notSetUp")} />;
  }
  const board = await getBoard(kiosk.ctx, kidId, { markSeen: true });
  if (!board) redirect("/kids");
  return <KidBoard initial={board} />;
}
