"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { ActionError, requireParent, runAction } from "@/lib/auth/session";
import { brand } from "@/lib/brand";
import { emailLayout, sendEmail } from "@/lib/email/send";
import { parentT } from "@/lib/i18n/parent";
import { zodErrorMessage } from "@/lib/i18n/parent/zodError";

const SupportInput = z.object({
  kind: z.enum(["feature", "bug", "question", "other"]),
  message: z.string().trim().min(3, "b.err.tellMore").max(4000),
  page: z.string().max(300).nullable().optional(),
  userAgent: z.string().max(400).nullable().optional(),
});

const KIND_LABEL = { feature: "💡 Feature request", bug: "🐞 Bug", question: "❓ Question", other: "💬 Other" } as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A parent sends the owners a feature request, bug report or question. Works in read-only homes too. */
export async function sendSupportMessage(input: z.input<typeof SupportInput>) {
  return runAction(async () => {
    const ctx = await requireParent();
    const parsed = SupportInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", zodErrorMessage(ctx.locale, parsed.error.issues));
    const { kind, message, page, userAgent } = parsed.data;

    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await ctx.supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= 10) throw new ActionError("invalid", parentT(ctx.locale)("b.err.tooManyMessages"));

    const { error } = await ctx.supabase.from("support_messages").insert({
      household_id: ctx.household.id,
      user_id: ctx.user.id,
      email: ctx.user.email,
      kind,
      message,
      page: page ?? null,
      user_agent: userAgent ?? null,
    });
    if (error) throw error;

    // Best effort: the message is already saved for the platform panel.
    // Sent after the response, so a slow email service never keeps the parent waiting.
    after(() =>
      sendEmail({
      to: brand.supportEmail,
      replyTo: ctx.user.email,
      subject: `${KIND_LABEL[kind]} from ${ctx.household.name}`,
      html: emailLayout(
        KIND_LABEL[kind],
        `<p style="white-space:pre-wrap;font-size:16px;line-height:1.5">${esc(message)}</p>
<p style="font-size:13px;color:#7A5A48">From ${esc(ctx.user.email)} · home “${esc(ctx.household.name)}”${page ? ` · page ${esc(page)}` : ""}<br>Reply to this email to answer them.</p>`,
      ),
    }),
    );
    revalidatePath("/admin/support");
  });
}
