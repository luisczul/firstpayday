import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveKiosk } from "@/lib/kiosk/auth";
import { getBoard } from "@/lib/kiosk/operations";
import { t } from "@/lib/i18n";
import { KioskMessage } from "../KioskMessage";
import { KidBoard } from "./KidBoard";

export const dynamic = "force-dynamic";

export default async function KidBoardPage({ params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  if (!z.uuid().safeParse(kidId).success) redirect("/kids");
  const kiosk = await resolveKiosk();
  if (kiosk.status === "revoked") return <KioskMessage emoji="🔌" message={t("en", "kid.disconnected")} />;
  if (kiosk.status === "none") return <KioskMessage emoji="📱" message={t("en", "kid.notSetUp")} />;
  const board = await getBoard(kiosk.ctx, kidId, { markSeen: true });
  if (!board) redirect("/kids");
  return <KidBoard initial={board} />;
}
