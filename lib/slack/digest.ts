import { formatMoney } from "@/lib/money/format";

export interface DigestHome {
  name: string;
  currency: string;
  kids: string[];
  choresDone: number;
  approved: number;
  paidCents: number;
}

export interface DigestData {
  date: string;
  signups: string[];
  newHomes: number;
  activeHomes: DigestHome[];
  totals: { homes: number; kids: number; parents: number };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The morning summary posted to the owner's Slack activity channel (last 24 hours). */
export function formatDigest(d: DigestData): string {
  const lines = [
    `*📊 First Payday: last 24 hours* (${d.date})`,
    `🎉 New signups: *${d.signups.length}*${d.signups.length ? ` (${d.signups.slice(0, 10).map(esc).join(", ")}${d.signups.length > 10 ? ", …" : ""})` : ""}`,
    `🏠 New homes: *${d.newHomes}*`,
    `🔥 Active homes: *${d.activeHomes.length}*`,
  ];
  const top = [...d.activeHomes].sort((a, b) => b.choresDone + b.approved - (a.choresDone + a.approved)).slice(0, 15);
  for (const h of top) {
    const parts = [`${h.choresDone} chore${h.choresDone === 1 ? "" : "s"} done`, `${h.approved} approved`];
    if (h.paidCents > 0) parts.push(`${formatMoney(h.paidCents, h.currency, "en")} paid`);
    lines.push(`   • 🏡 ${esc(h.name)}${h.kids.length ? ` (${h.kids.map(esc).join(", ")})` : ""}: ${parts.join(", ")}`);
  }
  if (d.activeHomes.length > top.length) lines.push(`   • …and ${d.activeHomes.length - top.length} more`);
  lines.push(`📈 All time: ${d.totals.homes} homes, ${d.totals.kids} kids, ${d.totals.parents} parents`);
  return lines.join("\n");
}
