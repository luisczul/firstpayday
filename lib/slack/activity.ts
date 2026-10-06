import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activitySource, formatActivity, type ActivityContext, type ActivityEvent, type ActivitySource } from "./format";

/**
 * The owner's Slack activity feed: signups, homes, kids, chores, approvals, payouts, from the web,
 * both native apps and the kids' tablet (they all go through this server). Off unless the incoming
 * webhook URL is set (Vercel env `slack_activity_hook`, or SLACK_ACTIVITY_HOOK).
 */
export function slackActivityHook(): string | null {
  const url = (process.env.SLACK_ACTIVITY_HOOK ?? process.env.slack_activity_hook ?? "").trim();
  return url.startsWith("https://hooks.slack.com/") ? url : null;
}

/**
 * Report one event. Runs after the response is sent, never throws and never slows the user down.
 * Pass `onTablet` from kiosk routes; the app/web source is read from the request's user agent.
 */
export function trackActivity(event: ActivityEvent, opts: { onTablet?: boolean; source?: ActivitySource } = {}): void {
  if (!slackActivityHook()) return;
  try {
    after(async () => {
      let source = opts.source;
      if (!source) {
        const ua = await headers()
          .then((h) => h.get("user-agent"))
          .catch(() => null);
        source = activitySource(ua, opts.onTablet);
      }
      await postActivity(event, source);
    });
  } catch {
    // Outside a request (scripts, tests): send right away instead.
    void postActivity(event, opts.source ?? "server");
  }
}

/** Test accounts (E2E, local) never reach the channel. */
const TEST_EMAIL = /@(example\.(test|com)|test\.local)$/i;

async function postActivity(event: ActivityEvent, source: ActivitySource): Promise<void> {
  const hook = slackActivityHook();
  if (!hook || (event.email && TEST_EMAIL.test(event.email))) return;
  try {
    const ctx = await lookup(event);
    if (ctx === "test") return;
    const res = await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: formatActivity(event, ctx, source) }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error("slack activity failed", res.status);
  } catch (e) {
    console.error("slack activity failed", e instanceof Error ? e.message : e);
  }
}

async function lookup(event: ActivityEvent): Promise<ActivityContext | "test"> {
  const ctx: ActivityContext = {};
  if (!event.householdId && !event.kidId && !event.submissionId) return ctx;
  const admin = createAdminClient();
  let kidId = event.kidId;
  if (event.submissionId) {
    const { data: sub } = await admin
      .from("submissions")
      .select("kid_id, chore_title_snapshot, amount_cents")
      .eq("id", event.submissionId)
      .maybeSingle();
    if (sub) {
      kidId ??= sub.kid_id;
      ctx.choreTitle = sub.chore_title_snapshot;
      ctx.amountCents = sub.amount_cents;
    }
  }
  if (event.householdId) {
    const [{ data: home }, { count }, { data: owner }] = await Promise.all([
      admin.from("households").select("name, currency, created_by").eq("id", event.householdId).maybeSingle(),
      admin.from("kids").select("id", { count: "exact", head: true }).eq("household_id", event.householdId).is("archived_at", null),
      admin.from("household_members").select("user_id").eq("household_id", event.householdId).eq("role", "owner").limit(1).maybeSingle(),
    ]);
    if (home) {
      ctx.homeName = home.name;
      ctx.currency = home.currency;
      ctx.kidCount = count ?? undefined;
    }
    const ownerId = owner?.user_id ?? home?.created_by;
    if (ownerId) {
      const { data } = await admin.auth.admin.getUserById(ownerId);
      if (data.user?.email && TEST_EMAIL.test(data.user.email)) return "test";
    }
  }
  if (kidId) {
    const { data: kid } = await admin.from("kids").select("name").eq("id", kidId).maybeSingle();
    if (kid) ctx.kidName = kid.name;
  }
  return ctx;
}
