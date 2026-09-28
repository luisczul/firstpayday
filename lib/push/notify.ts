import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { asLocale } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/format";
import { choreTextFor } from "@/lib/translate";
import { buildSubmissionPush } from "./payload";
import { sendApns, sendFcm } from "./providers";

/**
 * After a kid's "I did it!" / "Fixed it!": a push to every parent phone of the household that has
 * the native app. Runs in after(); never throws; auto-approved chores are skipped.
 */
export async function notifyNewSubmissionPush(householdId: string, submissionId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("submissions")
      .select("id, kid_id, status, amount_cents, chore_title_snapshot, resubmitted_at, chores(title, translations)")
      .eq("id", submissionId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (!sub || sub.status !== "pending") return;
    const { data: members } = await admin.from("household_members").select("user_id").eq("household_id", householdId);
    const userIds = (members ?? []).map((m) => m.user_id);
    if (!userIds.length) return;
    const { data: tokens } = await admin.from("push_tokens").select("id, token, platform, locale").in("user_id", userIds);
    if (!tokens?.length) return;

    const [{ data: household }, { data: kid }, { count: pending }] = await Promise.all([
      admin.from("households").select("locale, currency").eq("id", householdId).single(),
      admin.from("kids").select("name").eq("id", sub.kid_id).single(),
      admin.from("submissions").select("id", { count: "exact", head: true }).eq("household_id", householdId).eq("status", "pending"),
    ]);
    if (!household) return;

    const gone: string[] = [];
    await Promise.allSettled(
      tokens.map(async (t) => {
        const locale = asLocale(t.locale ?? household.locale);
        const push = buildSubmissionPush({
          locale,
          kidName: kid?.name ?? "?",
          choreTitle: choreTextFor(sub.chores?.translations, locale)?.title ?? sub.chores?.title ?? sub.chore_title_snapshot,
          amount: formatMoney(sub.amount_cents, household.currency, locale),
          pendingCount: pending ?? 1,
          submissionId: sub.id,
          resubmitted: Boolean(sub.resubmitted_at),
        });
        const result = t.platform === "ios" ? await sendApns(t.token, push) : await sendFcm(t.token, push);
        if (result === "gone") gone.push(t.id);
      }),
    );
    if (gone.length) await admin.from("push_tokens").delete().in("id", gone);
  } catch (e) {
    console.error("push failed", e instanceof Error ? e.message : e);
  }
}
