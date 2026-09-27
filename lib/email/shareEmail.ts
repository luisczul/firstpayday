// "Share First Payday" email: a parent invites a friend, in the language they pick.
// Pure apart from emailLayout, so it's unit-testable; app/actions/share.ts sends it.
import type { Locale } from "@/lib/i18n";
import { emailLayout } from "./send";
import { escapeHtml } from "./reviewEmail";

interface Copy {
  subject: (name: string) => string;
  title: string;
  lead: (name: string) => string;
  pitch: string;
  noteFrom: (name: string) => string;
  cta: string;
  footer: (name: string, email: string) => string;
}

const COPY: Record<Locale, Copy> = {
  en: {
    subject: (n) => `${n} thinks you'll love First Payday`,
    title: "You're invited to try First Payday",
    lead: (n) => `<strong>${n}</strong> is using First Payday with their kids and thought you'd love it too.`,
    pitch:
      "Kids earn their first paycheck by doing chores on a family tablet. Along the way they learn the value of money, responsibility and saving. It's free to use.",
    noteFrom: (n) => `A note from ${n}:`,
    cta: "Try First Payday — it's free",
    footer: (n, e) => `You're getting this because ${n} (${e}) shared First Payday with you. We won't email you unless someone invites you.`,
  },
  fr: {
    subject: (n) => `${n} pense que First Payday va vous plaire`,
    title: "Essayez First Payday",
    lead: (n) => `<strong>${n}</strong> utilise First Payday avec ses enfants et a pensé que ça vous plairait aussi.`,
    pitch:
      "Les enfants gagnent leur première paie en faisant des tâches sur une tablette familiale. Ils apprennent la valeur de l'argent, le sens des responsabilités et l'épargne. C'est gratuit.",
    noteFrom: (n) => `Un mot de ${n} :`,
    cta: "Essayer First Payday — c'est gratuit",
    footer: (n, e) =>
      `Vous recevez ce courriel parce que ${n} (${e}) vous a fait découvrir First Payday. Nous ne vous écrirons pas à moins que quelqu'un vous invite.`,
  },
  es: {
    subject: (n) => `${n} cree que First Payday te va a encantar`,
    title: "Te invitan a probar First Payday",
    lead: (n) => `<strong>${n}</strong> usa First Payday con sus hijos y pensó que a ti también te encantaría.`,
    pitch:
      "Los niños ganan su primer sueldo haciendo tareas en una tableta familiar. Así aprenden el valor del dinero, la responsabilidad y el ahorro. Es gratis.",
    noteFrom: (n) => `Un mensaje de ${n}:`,
    cta: "Prueba First Payday — es gratis",
    footer: (n, e) =>
      `Recibes este correo porque ${n} (${e}) compartió First Payday contigo. No te escribiremos a menos que alguien te invite.`,
  },
  pt: {
    subject: (n) => `${n} acha que você vai adorar o First Payday`,
    title: "Você foi convidado a experimentar o First Payday",
    lead: (n) => `<strong>${n}</strong> usa o First Payday com os filhos e achou que você também ia adorar.`,
    pitch:
      "As crianças ganham o primeiro salário fazendo tarefas em um tablet da família. No caminho, aprendem o valor do dinheiro, responsabilidade e a poupar. É grátis.",
    noteFrom: (n) => `Um recado de ${n}:`,
    cta: "Experimente o First Payday — é grátis",
    footer: (n, e) =>
      `Você está recebendo este e-mail porque ${n} (${e}) compartilhou o First Payday com você. Só voltaremos a escrever se alguém convidar você.`,
  },
};

const BUTTON =
  "display:inline-block;background:#B8431F;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:800;font-size:17px";

/** Public-site link in the friend's language: English at the root, others under /fr, /es, /pt. */
export function shareLink(baseUrl: string, locale: Locale): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${locale === "en" ? "/" : `/${locale}`}?ref=share`;
}

export function buildShareEmail(v: {
  locale: Locale;
  senderName: string;
  senderEmail: string;
  note?: string | null;
  baseUrl: string;
}): { subject: string; html: string; link: string } {
  const c = COPY[v.locale];
  const name = escapeHtml(v.senderName);
  const note = v.note?.trim();
  const link = shareLink(v.baseUrl, v.locale);
  const body = `<p style="font-size:17px;line-height:1.5;margin:0 0 12px">${c.lead(name)}</p>
<p style="font-size:16px;line-height:1.5;margin:0 0 16px">${c.pitch}</p>${
    note
      ? `
<p style="font-size:14px;color:#7A5A48;margin:0 0 4px">${c.noteFrom(name)}</p>
<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:4px solid #E7B04A;background:#FBF3E4;white-space:pre-wrap;font-size:16px;line-height:1.5">${escapeHtml(note)}</blockquote>`
      : ""
  }
<p style="margin:20px 0"><a href="${link}" style="${BUTTON}">${c.cta}</a></p>
<p style="font-size:12px;color:#7A5A48;margin:16px 0 0">${c.footer(name, escapeHtml(v.senderEmail))}</p>`;
  return { subject: c.subject(v.senderName), html: emailLayout(c.title, body), link };
}
