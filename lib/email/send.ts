import "server-only";
import { brand } from "@/lib/brand";

/**
 * Transactional email via Resend's HTTP API. Without RESEND_API_KEY this is a
 * no-op that returns false (SPEC §19.5: "skip in v1 if no key").
 */
export async function sendEmail(input: { to: string | string[]; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${brand.name} <${process.env.EMAIL_FROM || `no-reply@${brand.domain}`}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!res.ok) console.error("Resend error", res.status);
  return res.ok;
}

export function emailLayout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#FBF3E4;font-family:Nunito,Arial,sans-serif;color:#3B2418">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="font-size:22px;font-weight:800;color:#B8431F;margin-bottom:16px">${brand.name}</div>
<div style="background:#FFFAF1;border-radius:16px;padding:24px;border:1px solid #EAD8B8">
<h1 style="font-size:22px;margin:0 0 12px">${title}</h1>${body}</div>
<p style="font-size:12px;color:#7A5A48;margin-top:16px">${brand.legalEntityName}</p></div></body></html>`;
}
