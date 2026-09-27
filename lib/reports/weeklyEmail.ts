// Weekly parent report email: localized copy and HTML (body only; wrap it in
// emailLayout()). Pure so it can be unit-tested and previewed.
import { escapeHtml } from "@/lib/email/reviewEmail";
import { formatMoney } from "@/lib/money/format";
import { hourLabel, intlTag, timeAgo, weekdayLabel, type WeeklyReport } from "./weekly";

interface Copy {
  subject: (household: string, approved: number, earned: string) => string;
  title: string;
  period: (from: string, to: string) => string;
  approved: string;
  earned: string;
  earnedHint: string;
  paidOut: string;
  checkins: string;
  kidsHeading: string;
  kidCol: string;
  checkinsCol: string;
  approvedCol: string;
  earnedCol: string;
  paidCol: string;
  lastCheckin: (ago: string) => string;
  neverCheckedIn: string;
  bonus: (amount: string) => string;
  match: (amount: string) => string;
  adjustments: (amount: string) => string;
  activityHeading: string;
  submitted: string;
  resubmitted: string;
  sentBack: string;
  reversed: string;
  rejected: string;
  sentHeading: string;
  reviewEmails: (n: number) => string;
  quiet: string;
  button: string;
  footer: (day: string, hour: string) => string;
}

const COPY: Record<string, Copy> = {
  en: {
    subject: (h, n, e) => `${h}: your week on First Payday (${n} chore${n === 1 ? "" : "s"} approved, ${e} earned)`,
    title: "Your weekly report",
    period: (a, b) => `${a} to ${b}`,
    approved: "Chores approved",
    earned: "Money earned",
    earnedHint: "incl. tips and savings match",
    paidOut: "Paid out",
    checkins: "Tablet check-ins",
    kidsHeading: "By kid",
    kidCol: "Kid",
    checkinsCol: "Check-ins",
    approvedCol: "Approved",
    earnedCol: "Earned",
    paidCol: "Paid out",
    lastCheckin: (a) => `last ${a}`,
    neverCheckedIn: "no check-ins yet",
    bonus: (a) => `tips ${a}`,
    match: (a) => `match ${a}`,
    adjustments: (a) => `adjustments ${a}`,
    activityHeading: "Activity",
    submitted: "“I did it!” submissions",
    resubmitted: "Fixes sent back in",
    sentBack: "Sent back for a revision",
    reversed: "Approvals reversed",
    rejected: "Rejected",
    sentHeading: "Emails we sent you",
    reviewEmails: (n) => `${n} “ready for review” email${n === 1 ? "" : "s"} to parents`,
    quiet: "A quiet week: nothing new on the board.",
    button: "Open First Payday",
    footer: (d, h) => `You get this report every ${d} at ${h}. Change the day or turn it off in Settings.`,
  },
  fr: {
    subject: (h, n, e) => `${h} : votre semaine sur First Payday (${n} tâche${n > 1 ? "s" : ""} approuvée${n > 1 ? "s" : ""}, ${e} gagnés)`,
    title: "Votre rapport de la semaine",
    period: (a, b) => `du ${a} au ${b}`,
    approved: "Tâches approuvées",
    earned: "Argent gagné",
    earnedHint: "bonus et épargne jumelée inclus",
    paidOut: "Versé",
    checkins: "Visites sur la tablette",
    kidsHeading: "Par enfant",
    kidCol: "Enfant",
    checkinsCol: "Visites",
    approvedCol: "Approuvées",
    earnedCol: "Gagné",
    paidCol: "Versé",
    lastCheckin: (a) => `dernière : ${a}`,
    neverCheckedIn: "aucune visite",
    bonus: (a) => `bonus ${a}`,
    match: (a) => `épargne jumelée ${a}`,
    adjustments: (a) => `ajustements ${a}`,
    activityHeading: "Activité",
    submitted: "Envois « Je l’ai fait! »",
    resubmitted: "Corrections renvoyées",
    sentBack: "Renvoyées pour correction",
    reversed: "Approbations annulées",
    rejected: "Refusées",
    sentHeading: "Courriels envoyés",
    reviewEmails: (n) => `${n} courriel${n > 1 ? "s" : ""} « à vérifier » envoyé${n > 1 ? "s" : ""} aux parents`,
    quiet: "Semaine tranquille : rien de nouveau sur le tableau.",
    button: "Ouvrir First Payday",
    footer: (d, h) => `Vous recevez ce rapport chaque ${d} à ${h}. Changez le jour ou désactivez-le dans Paramètres.`,
  },
  es: {
    subject: (h, n, e) => `${h}: tu semana en First Payday (${n} tarea${n === 1 ? "" : "s"} aprobada${n === 1 ? "" : "s"}, ${e} ganados)`,
    title: "Tu informe semanal",
    period: (a, b) => `del ${a} al ${b}`,
    approved: "Tareas aprobadas",
    earned: "Dinero ganado",
    earnedHint: "incluye bonos y ahorro extra",
    paidOut: "Pagado",
    checkins: "Visitas a la tableta",
    kidsHeading: "Por niño",
    kidCol: "Niño",
    checkinsCol: "Visitas",
    approvedCol: "Aprobadas",
    earnedCol: "Ganado",
    paidCol: "Pagado",
    lastCheckin: (a) => `última: ${a}`,
    neverCheckedIn: "sin visitas aún",
    bonus: (a) => `bonos ${a}`,
    match: (a) => `ahorro extra ${a}`,
    adjustments: (a) => `ajustes ${a}`,
    activityHeading: "Actividad",
    submitted: "Envíos “¡Lo hice!”",
    resubmitted: "Correcciones reenviadas",
    sentBack: "Devueltas para corregir",
    reversed: "Aprobaciones anuladas",
    rejected: "Rechazadas",
    sentHeading: "Correos que te enviamos",
    reviewEmails: (n) => `${n} correo${n === 1 ? "" : "s"} de “listo para revisar” a los padres`,
    quiet: "Una semana tranquila: nada nuevo en el tablero.",
    button: "Abrir First Payday",
    footer: (d, h) => `Recibes este informe cada ${d} a las ${h}. Cambia el día o desactívalo en Ajustes.`,
  },
  pt: {
    subject: (h, n, e) => `${h}: sua semana no First Payday (${n} tarefa${n === 1 ? "" : "s"} aprovada${n === 1 ? "" : "s"}, ${e} ganhos)`,
    title: "Seu relatório semanal",
    period: (a, b) => `de ${a} a ${b}`,
    approved: "Tarefas aprovadas",
    earned: "Dinheiro ganho",
    earnedHint: "inclui bônus e poupança extra",
    paidOut: "Pago",
    checkins: "Visitas ao tablet",
    kidsHeading: "Por criança",
    kidCol: "Criança",
    checkinsCol: "Visitas",
    approvedCol: "Aprovadas",
    earnedCol: "Ganho",
    paidCol: "Pago",
    lastCheckin: (a) => `última: ${a}`,
    neverCheckedIn: "nenhuma visita ainda",
    bonus: (a) => `bônus ${a}`,
    match: (a) => `poupança extra ${a}`,
    adjustments: (a) => `ajustes ${a}`,
    activityHeading: "Atividade",
    submitted: "Envios “Eu fiz!”",
    resubmitted: "Correções reenviadas",
    sentBack: "Devolvidas para correção",
    reversed: "Aprovações desfeitas",
    rejected: "Recusadas",
    sentHeading: "E-mails que enviamos",
    reviewEmails: (n) => `${n} e-mail${n === 1 ? "" : "s"} de “pronto para conferir” para os pais`,
    quiet: "Uma semana tranquila: nada de novo no quadro.",
    button: "Abrir o First Payday",
    footer: (d, h) => `Você recebe este relatório toda semana (${d}, ${h}). Mude o dia ou desative em Configurações.`,
  },
};

export function weeklyCopy(locale: string): Copy {
  return COPY[locale] ?? COPY.en!;
}

export interface WeeklyEmailInput {
  locale: string;
  currency: string;
  timezone: string;
  householdName: string;
  report: WeeklyReport;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
  dow: number;
  hour: number;
  appUrl: string;
}

const ORANGE = "#B8431F";
const SOFT = "#7A5A48";
const LINE = "#EAD8B8";
const MOSS = "#4F7A3A";

export function buildWeeklyEmail(input: WeeklyEmailInput): { subject: string; title: string; bodyHtml: string } {
  const c = weeklyCopy(input.locale);
  const { report } = input;
  const money = (cents: number) => formatMoney(cents, input.currency, input.locale);
  const date = (d: Date) => {
    try {
      return new Intl.DateTimeFormat(intlTag(input.locale), { month: "short", day: "numeric", timeZone: input.timezone }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  };
  const t = report.totals;
  const earnedAll = t.earnedCents + t.bonusCents + t.matchCents;

  const tile = (label: string, value: string, hint = "") =>
    `<td style="width:50%;padding:6px"><div style="background:#FBF3E4;border-radius:12px;padding:12px">` +
    `<div style="font-size:12px;color:${SOFT};font-weight:700">${escapeHtml(label)}</div>` +
    `<div style="font-size:22px;font-weight:800;color:${ORANGE}">${escapeHtml(value)}</div>` +
    (hint ? `<div style="font-size:11px;color:${SOFT}">${escapeHtml(hint)}</div>` : "") +
    `</div></td>`;

  const tiles =
    `<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 4px">` +
    `<tr>${tile(c.approved, String(t.approved))}${tile(c.earned, money(earnedAll), c.earnedHint)}</tr>` +
    `<tr>${tile(c.paidOut, money(t.paidOutCents))}${tile(c.checkins, String(t.checkins))}</tr></table>`;

  const th = (s: string, align = "right") => `<th style="text-align:${align};font-size:12px;color:${SOFT};padding:6px 4px;border-bottom:1px solid ${LINE}">${escapeHtml(s)}</th>`;
  const td = (s: string, align = "right", extra = "") => `<td style="text-align:${align};padding:8px 4px;border-bottom:1px solid ${LINE};vertical-align:top;${extra}">${s}</td>`;
  const kidRows = report.kids
    .map((k) => {
      const last = k.lastCheckinAt ? c.lastCheckin(timeAgo(k.lastCheckinAt, input.now, input.locale)) : c.neverCheckedIn;
      const extras = [
        k.bonusCents ? c.bonus(money(k.bonusCents)) : "",
        k.matchCents ? c.match(money(k.matchCents)) : "",
        k.adjustmentCents ? c.adjustments(money(k.adjustmentCents)) : "",
      ].filter(Boolean);
      return (
        "<tr>" +
        td(`<strong>${escapeHtml(k.name)}</strong><div style="font-size:11px;color:${SOFT}">${escapeHtml(last)}</div>`, "left") +
        td(String(k.checkins)) +
        td(String(k.approved)) +
        td(`<strong style="color:${MOSS}">${escapeHtml(money(k.earnedCents + k.bonusCents + k.matchCents))}</strong>` + (extras.length ? `<div style="font-size:11px;color:${SOFT}">${escapeHtml(extras.join(" · "))}</div>` : "")) +
        td(escapeHtml(money(k.paidOutCents))) +
        "</tr>"
      );
    })
    .join("");
  const kidsTable = report.kids.length
    ? `<h2 style="font-size:16px;margin:20px 0 4px">${escapeHtml(c.kidsHeading)}</h2>` +
      `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">` +
      `<tr>${th(c.kidCol, "left")}${th(c.checkinsCol)}${th(c.approvedCol)}${th(c.earnedCol)}${th(c.paidCol)}</tr>${kidRows}</table>`
    : "";

  const line = (label: string, n: number) =>
    `<tr><td style="padding:4px 0">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right;font-weight:800">${n}</td></tr>`;
  const activity =
    `<h2 style="font-size:16px;margin:20px 0 4px">${escapeHtml(c.activityHeading)}</h2>` +
    `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">` +
    line(c.submitted, t.submitted) +
    line(c.resubmitted, t.resubmitted) +
    line(c.sentBack, t.sentBack) +
    line(c.reversed, t.reversed) +
    line(c.rejected, t.rejected) +
    `</table>`;

  const sent =
    `<h2 style="font-size:16px;margin:20px 0 4px">${escapeHtml(c.sentHeading)}</h2>` +
    `<p style="margin:0;font-size:14px">${escapeHtml(c.reviewEmails(report.reviewEmailsSent))}</p>`;

  const url = `${input.appUrl}/admin`;
  const bodyHtml =
    `<p style="margin:0 0 8px;color:${SOFT}">${escapeHtml(input.householdName)} · ${escapeHtml(c.period(date(input.periodStart), date(input.periodEnd)))}</p>` +
    (report.hasActivity ? "" : `<p>${escapeHtml(c.quiet)}</p>`) +
    tiles +
    kidsTable +
    activity +
    sent +
    `<p style="margin:24px 0 8px"><a href="${escapeHtml(url)}" style="display:inline-block;background:${ORANGE};color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:800">${escapeHtml(c.button)}</a></p>` +
    `<p style="font-size:12px;color:${SOFT};margin:16px 0 0">${escapeHtml(c.footer(weekdayLabel(input.dow, input.locale), hourLabel(input.hour, input.locale)))}</p>`;

  return {
    subject: c.subject(input.householdName, t.approved, money(earnedAll)),
    title: c.title,
    bodyHtml,
  };
}
