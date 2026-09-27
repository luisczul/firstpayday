"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireParent, runAction, type ParentContext } from "@/lib/auth/session";
import { appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { buildShareEmail } from "@/lib/email/shareEmail";
import { LOCALES, type Locale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";
import { zodErrorMessage } from "@/lib/i18n/parent/zodError";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_PER_SEND = 10;
const DAILY_CAP = 20;
const DAY_MS = 86_400_000;

const Name = z
  .string()
  .trim()
  .min(1, "c.err.nameRequired")
  .max(40, "c.err.nameTooLong")
  .refine((s) => !/[\r\n<>]/.test(s), "c.err.nameRequired");

const ShareInput = z.object({
  emails: z
    .array(z.string().trim().toLowerCase().pipe(z.email("c.err.invalidEmail").max(320, "c.err.invalidEmail")))
    .min(1, "c.err.noEmails")
    .max(MAX_PER_SEND, "c.err.tooMany"),
  senderName: Name,
  note: z.string().trim().max(300, "c.err.noteTooLong").optional().nullable(),
  locale: z.enum(LOCALES as [Locale, ...Locale[]]),
});

export type ShareResultStatus = "sent" | "recent" | "member" | "failed" | "limit" | "self";
export type ShareResult = { email: string; status: ShareResultStatus };

/** How many invitation emails this household sent in the last 24 hours. */
async function sentToday(admin: ReturnType<typeof createAdminClient>, householdId: string, since: string) {
  const { count, error } = await admin
    .from("share_invites")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .gte("last_sent_at", since);
  if (error) throw error;
  return count ?? 0;
}

async function hasAccount(admin: ReturnType<typeof createAdminClient>, email: string): Promise<boolean> {
  const { data, error } = await admin.rpc("email_has_account", { p_email: email });
  if (error) throw error;
  return data === true;
}

function send(ctx: ParentContext, to: string, locale: Locale, senderName: string, note: string | null) {
  const mail = buildShareEmail({ locale, senderName, senderEmail: ctx.user.email, note, baseUrl: appUrl() });
  return sendEmail({ to, subject: mail.subject, html: mail.html, replyTo: ctx.user.email || undefined });
}

/** A parent emails up to 10 friends an invitation to try First Payday, personalized with their name. */
export async function sendShareInvites(input: z.input<typeof ShareInput>) {
  return runAction<{ results: ShareResult[] }>(async () => {
    const ctx = await requireParent();
    const parsed = ShareInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", zodErrorMessage(ctx.locale, parsed.error.issues));
    const { senderName, locale } = parsed.data;
    const note = parsed.data.note || null;
    const emails = [...new Set(parsed.data.emails)];

    // The name they sign with becomes their display name in the app too.
    if (senderName !== (ctx.membership.display_name ?? "")) {
      const { error } = await ctx.supabase
        .from("household_members")
        .update({ display_name: senderName })
        .eq("household_id", ctx.household.id)
        .eq("user_id", ctx.user.id);
      if (error) throw error;
    }

    const admin = createAdminClient();
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { data: existing, error: exErr } = await admin
      .from("share_invites")
      .select("id, email, last_sent_at, send_count")
      .eq("household_id", ctx.household.id)
      .in("email", emails);
    if (exErr) throw exErr;
    const byEmail = new Map((existing ?? []).map((r) => [r.email, r]));

    let budget = DAILY_CAP - (await sentToday(admin, ctx.household.id, since));
    const results: ShareResult[] = [];
    const toSend: string[] = [];
    for (const email of emails) {
      const prev = byEmail.get(email);
      if (email === ctx.user.email.toLowerCase()) results.push({ email, status: "self" });
      else if (prev && Date.parse(prev.last_sent_at) >= Date.parse(since)) results.push({ email, status: "recent" });
      else if (await hasAccount(admin, email)) results.push({ email, status: "member" });
      else if (budget <= 0) results.push({ email, status: "limit" });
      else {
        budget--;
        toSend.push(email);
        results.push({ email, status: "sent" });
      }
    }

    const delivered = await Promise.all(toSend.map((email) => send(ctx, email, locale, senderName, note)));
    const now = new Date().toISOString();
    for (const [i, email] of toSend.entries()) {
      const r = results.find((x) => x.email === email)!;
      if (!delivered[i]) {
        r.status = "failed";
        continue;
      }
      const prev = byEmail.get(email);
      const { error } = prev
        ? await admin
            .from("share_invites")
            .update({ last_sent_at: now, send_count: prev.send_count + 1, locale, sender_user_id: ctx.user.id })
            .eq("id", prev.id)
            .eq("household_id", ctx.household.id)
        : await admin.from("share_invites").insert({
            household_id: ctx.household.id,
            sender_user_id: ctx.user.id,
            email,
            locale,
            sent_at: now,
            last_sent_at: now,
          });
      if (error) throw error;
    }

    revalidatePath("/admin/share");
    return { results };
  });
}

/** Send one invitation again (at most once a day per address). */
export async function resendShareInvite(id: string) {
  return runAction(async () => {
    const ctx = await requireParent();
    const t = parentT(ctx.locale);
    if (!z.uuid().safeParse(id).success) throw new ActionError("not_found", t("c.err.notFound"));
    const senderName = Name.safeParse(ctx.membership.display_name ?? "");
    if (!senderName.success) throw new ActionError("invalid", t("c.err.nameRequired"));

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("share_invites")
      .select("id, email, locale, last_sent_at, send_count, joined_user_id")
      .eq("id", id)
      .eq("household_id", ctx.household.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new ActionError("not_found", t("c.err.notFound"));
    if (row.joined_user_id || (await hasAccount(admin, row.email))) {
      throw new ActionError("invalid", t("c.err.alreadyJoined", { email: row.email }));
    }
    const since = new Date(Date.now() - DAY_MS).toISOString();
    if (Date.parse(row.last_sent_at) >= Date.parse(since)) throw new ActionError("limit", t("c.share.resendWait", { email: row.email }));
    if ((await sentToday(admin, ctx.household.id, since)) >= DAILY_CAP) throw new ActionError("limit", t("c.err.dailyLimit"));

    const locale = (LOCALES as readonly string[]).includes(row.locale) ? (row.locale as Locale) : ctx.locale;
    if (!(await send(ctx, row.email, locale, senderName.data, null))) throw new ActionError("invalid", t("c.err.sendFailed"));
    const { error: upErr } = await admin
      .from("share_invites")
      .update({ last_sent_at: new Date().toISOString(), send_count: row.send_count + 1, sender_user_id: ctx.user.id })
      .eq("id", row.id)
      .eq("household_id", ctx.household.id);
    if (upErr) throw upErr;
    revalidatePath("/admin/share");
    return undefined;
  });
}
