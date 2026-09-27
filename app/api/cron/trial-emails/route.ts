import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { brand } from "@/lib/brand";
import { asLocale } from "@/lib/i18n";
import { buildTrialEmail } from "@/lib/email/trialEmail";
import { billingEnabled } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily (vercel.json cron): "3 days left" on day 11, "trial ended — your data
 * is safe" on day 14 (SPEC §19.5). No-op without RESEND_API_KEY.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // First Payday is free: no trial reminders while billing is switched off.
  if (!billingEnabled()) return NextResponse.json({ skipped: "billing disabled" });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ skipped: "no RESEND_API_KEY" });

  const admin = createAdminClient();
  const now = Date.now();
  const { data: trials } = await admin
    .from("subscriptions")
    .select("household_id, trial_ends_at, trial_reminder_sent_at, trial_ended_email_sent_at")
    .eq("plan", "trial")
    .not("trial_ends_at", "is", null);

  let sent = 0;
  for (const t of trials ?? []) {
    const ends = new Date(t.trial_ends_at!).getTime();
    const reminder = !t.trial_reminder_sent_at && ends > now && ends - now <= 3 * 86_400_000;
    const ended = !t.trial_ended_email_sent_at && ends <= now && now - ends < 7 * 86_400_000;
    if (!reminder && !ended) continue;

    const { data: owners } = await admin.from("household_members").select("user_id").eq("household_id", t.household_id).eq("role", "owner");
    const emails = (
      await Promise.all((owners ?? []).map(async (o) => (await admin.auth.admin.getUserById(o.user_id)).data.user?.email))
    ).filter((e): e is string => Boolean(e));
    if (!emails.length) continue;

    const { data: household } = await admin.from("households").select("locale").eq("id", t.household_id).maybeSingle();
    const email = buildTrialEmail(reminder ? "reminder" : "ended", asLocale(household?.locale), {
      brandName: brand.name,
      billingUrl: `${appUrl()}/admin/settings/billing`,
    });
    const ok = await sendEmail({ to: emails, subject: email.subject, html: emailLayout(email.title, email.bodyHtml) });
    if (ok) {
      sent++;
      await admin
        .from("subscriptions")
        .update(reminder ? { trial_reminder_sent_at: new Date().toISOString() } : { trial_ended_email_sent_at: new Date().toISOString() })
        .eq("household_id", t.household_id);
    }
  }
  return NextResponse.json({ sent });
}
