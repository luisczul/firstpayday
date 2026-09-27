import "server-only";
import type { ParentContext } from "@/lib/auth/session";

export interface HistoryFilters {
  kid?: string;
  chore?: string;
  type?: "all" | "submissions" | "earning" | "bonus" | "promo" | "payout" | "tax" | "adjustment" | "match";
  from?: string;
  to?: string;
}

export interface HistoryRow {
  id: string;
  at: string;
  type: string;
  kidId: string;
  kidName: string;
  title: string;
  status: string | null;
  amountCents: number;
  note: string | null;
  /** Name of the tablet a submission came from; null when unknown or not a submission. */
  tablet: string | null;
}

/** Combined feed of submissions and ledger events (SPEC §8 A5). */
export async function loadHistory(ctx: ParentContext, f: HistoryFilters, limit = 500): Promise<HistoryRow[]> {
  const hid = ctx.household.id;
  const [{ data: kids }, { data: devices }] = await Promise.all([
    ctx.supabase.from("kids").select("id, name").eq("household_id", hid),
    ctx.supabase.from("devices").select("id, name").eq("household_id", hid),
  ]);
  const kidName = new Map((kids ?? []).map((k) => [k.id, k.name]));
  const deviceName = new Map((devices ?? []).map((d) => [d.id, d.name]));
  const type = f.type ?? "all";
  const rows: HistoryRow[] = [];
  // Date filters are inclusive local days; the day after `to` is exclusive.
  const toExclusive = f.to ? new Date(new Date(`${f.to}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10) : undefined;

  if (type === "all" || type === "submissions") {
    let q = ctx.supabase
      .from("submissions")
      .select("id, kid_id, chore_id, chore_title_snapshot, status, amount_cents, submitted_at, review_comment, device_id, chores(title)")
      .eq("household_id", hid)
      .order("submitted_at", { ascending: false })
      .limit(limit);
    if (f.kid) q = q.eq("kid_id", f.kid);
    if (f.chore) q = q.eq("chore_id", f.chore);
    if (f.from) q = q.gte("submitted_at", f.from);
    if (toExclusive) q = q.lt("submitted_at", toExclusive);
    const { data } = await q;
    for (const s of data ?? []) {
      rows.push({
        id: s.id,
        at: s.submitted_at,
        type: "submission",
        kidId: s.kid_id,
        kidName: kidName.get(s.kid_id) ?? "?",
        title: s.chores?.title ?? s.chore_title_snapshot,
        status: s.status,
        amountCents: s.amount_cents,
        note: s.review_comment,
        tablet: s.device_id ? (deviceName.get(s.device_id) ?? null) : null,
      });
    }
  }

  if (type !== "submissions" && !f.chore) {
    let q = ctx.supabase
      .from("ledger_entries")
      .select("id, kid_id, kind, amount_cents, note, method, icon, title, created_at, submissions(chore_title_snapshot, chores(title))")
      .eq("household_id", hid)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (f.kid) q = q.eq("kid_id", f.kid);
    if (type !== "all") q = q.eq("kind", type);
    if (f.from) q = q.gte("created_at", f.from);
    if (toExclusive) q = q.lt("created_at", toExclusive);
    const { data } = await q;
    for (const l of data ?? []) {
      // Money lines name the chore as it was when saved: show its current (linked) name.
      const snap = l.submissions?.chore_title_snapshot;
      const current = l.submissions?.chores?.title;
      const noteNow = l.note && snap && current && l.note.endsWith(snap) ? l.note.slice(0, l.note.length - snap.length) + current : l.note;
      rows.push({
        id: l.id,
        at: l.created_at,
        type: l.kind,
        kidId: l.kid_id,
        kidName: kidName.get(l.kid_id) ?? "?",
        title: l.title ? `${l.icon ?? "⭐"} ${l.title}` : l.kind === "payout" ? `Payout${l.method ? ` (${l.method})` : ""}` : (noteNow ?? l.kind),
        status: null,
        amountCents: l.amount_cents,
        note: noteNow,
        tablet: null,
      });
    }
  }

  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function toCsv(rows: HistoryRow[]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    // Neutralise spreadsheet formulas and quote everything.
    const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ["date", "kid", "type", "title", "status", "amount", "note", "tablet"];
  const lines = rows.map((r) =>
    [r.at, r.kidName, r.type, r.title, r.status, (r.amountCents / 100).toFixed(2), r.note, r.tablet].map(esc).join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
