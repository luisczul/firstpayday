import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { asLocale, intlLocale } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/format";
import { buildReviewEmail, pickReviewRecipients, throttleCutoff } from "./reviewEmail";

const REVIEW_PATH = "/admin/approvals";

/**
 * After a kiosk "I did it!" / "Fixed it!": email every opted-in parent of the
 * household that a chore is waiting, with a one-click sign-in button.
 *
 * Runs via next/server `after()`, i.e. after the kid already has their
 * response. Never throws. Auto-approved submissions are skipped (status is
 * re-read here, so callers don't need to know).
 */
export async function notifyReviewReady(householdId: string, submissionId: string): Promise<void> {
  try {
    await run(householdId, submissionId);
  } catch (e) {
    console.error("review email failed", e instanceof Error ? e.message : e);
  }
}

async function run(householdId: string, submissionId: string) {
  const isDev = process.env.NODE_ENV !== "production";
  // Production without a mail provider: nothing to do (don't mint login links).
  if (!process.env.RESEND_API_KEY && !isDev) return;

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("submissions")
    .select("id, kid_id, status, amount_cents, chore_title_snapshot, submitted_at, resubmitted_at")
    .eq("id", submissionId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!sub || sub.status !== "pending") return;

  const now = new Date();
  const { data: members } = await admin
    .from("household_members")
    .select("user_id, role, review_emails_enabled, review_email_sent_at")
    .eq("household_id", householdId);
  const due = pickReviewRecipients(members ?? [], now);
  if (!due.length) return;

  const [{ data: household }, { data: kid }, { count: pending }] = await Promise.all([
    admin.from("households").select("locale, currency, timezone").eq("id", householdId).single(),
    admin.from("kids").select("name").eq("id", sub.kid_id).eq("household_id", householdId).single(),
    admin.from("submissions").select("id", { count: "exact", head: true }).eq("household_id", householdId).eq("status", "pending"),
  ]);
  if (!household) return;
  const locale = asLocale(household.locale);
  const at = new Date(sub.resubmitted_at ?? sub.submitted_at);
  let when: string;
  try {
    when = new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: household.timezone,
    }).format(at);
  } catch {
    when = at.toISOString();
  }

  await Promise.allSettled(
    due.map(async (m) => {
      // Atomic claim: only one concurrent notifier wins the window for this parent.
      const { data: claimed } = await admin
        .from("household_members")
        .update({ review_email_sent_at: now.toISOString() })
        .eq("household_id", householdId)
        .eq("user_id", m.user_id)
        .eq("review_emails_enabled", true)
        .or(`review_email_sent_at.is.null,review_email_sent_at.lt.${throttleCutoff(now)}`)
        .select("user_id");
      if (!claimed?.length) return;
      const release = () =>
        admin
          .from("household_members")
          .update({ review_email_sent_at: m.review_email_sent_at })
          .eq("household_id", householdId)
          .eq("user_id", m.user_id)
          .eq("review_email_sent_at", now.toISOString());

      const email = (await admin.auth.admin.getUserById(m.user_id)).data.user?.email;
      if (!email) return void (await release());

      // Single-use, 1h (Supabase OTP expiry) token. We build our own link to
      // /auth/confirm so the session cookie is set on our domain directly.
      const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const hashed = link?.properties?.hashed_token;
      if (error || !hashed) {
        console.error("review email: generateLink failed", error?.message);
        return void (await release());
      }
      const base = appUrl();
      const reviewUrl = `${base}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${encodeURIComponent(REVIEW_PATH)}`;
      const content = buildReviewEmail({
        locale,
        kidName: kid?.name ?? "",
        choreTitle: sub.chore_title_snapshot,
        amount: formatMoney(sub.amount_cents, household.currency, locale),
        when,
        resubmitted: Boolean(sub.resubmitted_at),
        pendingCount: Math.max(1, pending ?? 1),
        reviewUrl,
        loginUrl: `${base}/login?next=${encodeURIComponent(REVIEW_PATH)}`,
      });

      // Dev convenience (never in production: the link is a login token).
      if (isDev) console.info(`[review email] to=${email} subject="${content.subject}" link=${reviewUrl}`);
      const ok = await sendEmail({ to: email, subject: content.subject, html: emailLayout(content.title, content.bodyHtml) });
      if (ok) {
        // Counted in the weekly parent report ("what we sent you").
        const { error: logError } = await admin
          .from("email_log")
          .insert({ household_id: householdId, kind: "review_ready", recipient_user_id: m.user_id });
        if (logError) console.error("email_log insert failed", logError.message);
      } else if (process.env.RESEND_API_KEY) await release(); // let the next submission retry
    }),
  );
}
