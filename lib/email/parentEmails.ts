// Parent-facing emails (co-parent invite, failed payment) in the household's language.
// Pure so they're unit-testable; callers wrap title + body with emailLayout and send.
import type { Locale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";
import { escapeHtml } from "./reviewEmail";

export interface ParentEmail {
  subject: string;
  /** HTML-safe, for emailLayout's heading. */
  title: string;
  /** HTML body. */
  body: string;
}

const BUTTON = "display:inline-block;background:#B8431F;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:800";

export function inviteEmail(v: { locale: Locale; home: string; inviter: string; brand: string; link: string }): ParentEmail {
  const t = parentT(v.locale);
  return {
    subject: t("b.email.invite.subject", { home: v.home, brand: v.brand }),
    title: escapeHtml(t("b.email.invite.title", { home: v.home })),
    body: `<p>${escapeHtml(t("b.email.invite.body", { inviter: v.inviter }))}</p>
         <p><a href="${v.link}" style="${BUTTON}">${escapeHtml(t("b.email.invite.cta"))}</a></p>
         <p style="font-size:13px;color:#7A5A48">${escapeHtml(t("b.email.invite.expires"))}</p>`,
  };
}

export function paymentFailedEmail(v: { locale: Locale; brand: string; billingUrl: string }): ParentEmail {
  const t = parentT(v.locale);
  return {
    subject: t("b.email.payFailed.subject", { brand: v.brand }),
    title: escapeHtml(t("b.email.payFailed.title")),
    body: `<p>${escapeHtml(t("b.email.payFailed.body"))}</p>
       <p><a href="${v.billingUrl}">${escapeHtml(t("b.email.payFailed.cta"))}</a></p>`,
  };
}
