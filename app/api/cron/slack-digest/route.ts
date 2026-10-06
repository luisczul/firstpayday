import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/crypto";
import { slackActivityHook } from "@/lib/slack/activity";
import { formatDigest, type DigestHome } from "@/lib/slack/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_EMAIL = /@(example\.(test|com)|test\.local)$/i;

/**
 * Daily (vercel.json cron, 9 a.m. Montréal): yesterday's signups, new homes and which homes and kids
 * were active, posted to the owner's Slack activity channel. No-op without the webhook URL.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hook = slackActivityHook();
  if (!hook) return NextResponse.json({ skipped: "no slack_activity_hook" });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();

  const signups: string[] = [];
  let parents = 0;
  const testUsers = new Set<string>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email && TEST_EMAIL.test(u.email)) {
        testUsers.add(u.id);
        continue;
      }
      parents++;
      if (u.created_at >= since && u.email) signups.push(u.email);
    }
    if (data.users.length < 1000) break;
  }

  const [{ data: homes }, { data: kids }, { data: subs }, { data: ledger }] = await Promise.all([
    admin.from("households").select("id, name, currency, created_at, created_by"),
    admin.from("kids").select("id, household_id, name").is("archived_at", null),
    admin.from("submissions").select("household_id, kid_id, status, submitted_at, reviewed_at").or(`submitted_at.gte.${since},reviewed_at.gte.${since}`),
    admin.from("ledger_entries").select("household_id, kid_id, amount_cents").eq("kind", "payout").gte("created_at", since),
  ]);

  const realHomes = (homes ?? []).filter((h) => !h.created_by || !testUsers.has(h.created_by));
  const homeById = new Map(realHomes.map((h) => [h.id, h]));
  const kidName = new Map((kids ?? []).map((k) => [k.id, k.name]));
  const active = new Map<string, DigestHome & { kidIds: Set<string> }>();
  const entry = (householdId: string) => {
    const h = homeById.get(householdId);
    if (!h) return null;
    let a = active.get(householdId);
    if (!a) {
      a = { name: h.name, currency: h.currency, kids: [], choresDone: 0, approved: 0, paidCents: 0, kidIds: new Set() };
      active.set(householdId, a);
    }
    return a;
  };
  for (const s of subs ?? []) {
    const a = entry(s.household_id);
    if (!a) continue;
    a.kidIds.add(s.kid_id);
    if (s.submitted_at >= since) a.choresDone++;
    if (s.status === "approved" && s.reviewed_at && s.reviewed_at >= since) a.approved++;
  }
  for (const l of ledger ?? []) {
    const a = entry(l.household_id);
    if (!a) continue;
    a.kidIds.add(l.kid_id);
    a.paidCents += Math.abs(l.amount_cents);
  }
  const activeHomes = [...active.values()].map(({ kidIds, ...h }) => ({ ...h, kids: [...kidIds].map((id) => kidName.get(id) ?? "?") }));

  const text = formatDigest({
    date: new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" }).format(new Date()),
    signups,
    newHomes: realHomes.filter((h) => h.created_at >= since).length,
    activeHomes,
    totals: {
      homes: realHomes.length,
      kids: (kids ?? []).filter((k) => homeById.has(k.household_id)).length,
      parents,
    },
  });
  const res = await fetch(hook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(8000),
  });
  return NextResponse.json({ ok: res.ok, activeHomes: activeHomes.length, signups: signups.length });
}
