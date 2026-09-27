// Pure helpers for the "a chore is ready for review" parent email: who gets
// it (opt-in + throttle) and what it says (en/fr/es/pt). No I/O here so it's
// unit-testable; lib/email/reviewNotify.ts does the sending.
import type { Locale } from "@/lib/i18n";

/** One email per parent per household per window, however many chores the kid taps. */
export const REVIEW_EMAIL_WINDOW_MS = 10 * 60_000;

export interface ReviewMember {
  user_id: string;
  role: string;
  review_emails_enabled: boolean;
  review_email_sent_at: string | null;
}

/** Parent opted in and not emailed within the window. */
export function isDueForReviewEmail(m: ReviewMember, now: Date, windowMs = REVIEW_EMAIL_WINDOW_MS): boolean {
  if (!m.review_emails_enabled) return false;
  if (m.role !== "owner" && m.role !== "parent") return false;
  if (!m.review_email_sent_at) return true;
  const last = new Date(m.review_email_sent_at).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= windowMs;
}

export function pickReviewRecipients<T extends ReviewMember>(members: readonly T[], now: Date, windowMs = REVIEW_EMAIL_WINDOW_MS): T[] {
  return members.filter((m) => isDueForReviewEmail(m, now, windowMs));
}

/** ISO cutoff for the DB-side claim: stamps older than this may be re-claimed. */
export function throttleCutoff(now: Date, windowMs = REVIEW_EMAIL_WINDOW_MS): string {
  return new Date(now.getTime() - windowMs).toISOString();
}

/** Only relative in-app admin paths; blocks //host, /\host and absolute URLs. */
export function safeAdminNext(next: string | null | undefined, fallback = "/admin"): string {
  if (!next) return fallback;
  if (!/^\/admin(?:[/?#]|$)/.test(next)) return fallback;
  if (next.includes("\\") || next.includes("//") || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface ReviewEmailInput {
  locale: Locale;
  kidName: string;
  choreTitle: string;
  /** Already formatted, e.g. "$2.00". */
  amount: string;
  /** Already formatted in the household's timezone. */
  when: string;
  resubmitted: boolean;
  /** Pending submissions in the household at send time (>= 1). */
  pendingCount: number;
  reviewUrl: string;
  loginUrl: string;
}

const copy = {
  en: {
    subject: (kid: string, n: number) => (n > 1 ? `${n} chores waiting for review` : `${kid} finished a chore — ready for review`),
    title: (kid: string, resub: boolean) => (resub ? `${kid} fixed a chore` : `${kid} says “I did it!”`),
    chore: "Chore",
    amount: "Amount",
    when: "When",
    more: (n: number) => `${n} chores are waiting for review in total.`,
    button: "Review now",
    expiry: "This button signs you in automatically. It works once, for 1 hour. After that, log in normally:",
    login: "Log in",
    footer: "You get this because you're a parent on this household. Turn it off in Settings → You.",
  },
  fr: {
    subject: (kid: string, n: number) => (n > 1 ? `${n} tâches à vérifier` : `${kid} a terminé une tâche — à vérifier`),
    title: (kid: string, resub: boolean) => (resub ? `${kid} a corrigé une tâche` : `${kid} dit « Je l’ai fait! »`),
    chore: "Tâche",
    amount: "Montant",
    when: "Quand",
    more: (n: number) => `${n} tâches attendent votre vérification au total.`,
    button: "Vérifier maintenant",
    expiry: "Ce bouton vous connecte automatiquement. Il fonctionne une seule fois, pendant 1 heure. Ensuite, connectez-vous normalement :",
    login: "Se connecter",
    footer: "Vous recevez ce courriel parce que vous êtes parent dans ce foyer. Désactivez-le dans Paramètres → Vous.",
  },
  es: {
    subject: (kid: string, n: number) => (n > 1 ? `${n} tareas esperando revisión` : `${kid} terminó una tarea — lista para revisar`),
    title: (kid: string, resub: boolean) => (resub ? `${kid} arregló una tarea` : `${kid} dice “¡Lo hice!”`),
    chore: "Tarea",
    amount: "Monto",
    when: "Cuándo",
    more: (n: number) => `En total hay ${n} tareas esperando revisión.`,
    button: "Revisar ahora",
    expiry: "Este botón inicia tu sesión automáticamente. Funciona una sola vez, durante 1 hora. Después, inicia sesión normalmente:",
    login: "Iniciar sesión",
    footer: "Recibes este correo porque eres madre o padre en este hogar. Desactívalo en Ajustes → Tú.",
  },
  pt: {
    subject: (kid: string, n: number) => (n > 1 ? `${n} tarefas esperando conferência` : `${kid} terminou uma tarefa — pronta para conferir`),
    title: (kid: string, resub: boolean) => (resub ? `${kid} arrumou uma tarefa` : `${kid} diz “Eu fiz!”`),
    chore: "Tarefa",
    amount: "Valor",
    when: "Quando",
    more: (n: number) => `Ao todo, ${n} tarefas estão esperando conferência.`,
    button: "Conferir agora",
    expiry: "Este botão faz o seu login automaticamente. Ele funciona uma única vez, por 1 hora. Depois disso, entre normalmente:",
    login: "Entrar",
    footer: "Você recebe este e-mail porque é responsável nesta casa. Desative em Configurações → Você.",
  },
} satisfies Record<Locale, unknown>;

/** Subject + inner HTML (wrapped by emailLayout at send time). All user text is escaped. */
export function buildReviewEmail(input: ReviewEmailInput): { subject: string; title: string; bodyHtml: string } {
  const c = copy[input.locale] ?? copy.en;
  const kid = escapeHtml(input.kidName);
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#7A5A48">${label}</td><td style="padding:4px 0;font-weight:700">${value}</td></tr>`;
  const bodyHtml = `<table style="border-collapse:collapse;margin:0 0 16px;font-size:16px">
${row(c.chore, escapeHtml(input.choreTitle))}
${row(c.amount, escapeHtml(input.amount))}
${row(c.when, escapeHtml(input.when))}
</table>
${input.pendingCount > 1 ? `<p style="margin:0 0 16px">${c.more(input.pendingCount)}</p>` : ""}
<p style="margin:0 0 20px"><a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;background:#B8431F;color:#fff;padding:16px 28px;border-radius:12px;text-decoration:none;font-weight:800;font-size:18px">${c.button}</a></p>
<p style="font-size:13px;color:#7A5A48;margin:0 0 4px">${c.expiry} <a href="${escapeHtml(input.loginUrl)}" style="color:#B8431F">${c.login}</a></p>
<p style="font-size:12px;color:#7A5A48;margin:16px 0 0">${c.footer}</p>`;
  // Subject is plain text (not HTML), so the raw kid name is fine there.
  return { subject: c.subject(input.kidName, input.pendingCount), title: c.title(kid, input.resubmitted), bodyHtml };
}
