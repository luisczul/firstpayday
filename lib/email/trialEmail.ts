// Trial lifecycle emails ("3 days left" / "trial ended"), in the household's
// language. Pure so it's unit-testable; app/api/cron/trial-emails sends them.
import type { Locale } from "@/lib/i18n";
import { escapeHtml } from "./reviewEmail";

export type TrialEmailKind = "reminder" | "ended";

const copy: Record<Locale, Record<TrialEmailKind, { subject: (brand: string) => string; title: string; body: string; cta: string }>> = {
  en: {
    reminder: {
      subject: (b) => `3 days left in your ${b} trial`,
      title: "3 days left",
      body: "Your kids' board keeps running until your trial ends. Pick a plan any time to keep it going.",
      cta: "Choose a plan",
    },
    ended: {
      subject: (b) => `Your ${b} trial ended — your data is safe`,
      title: "Your trial ended",
      body: "Nothing was deleted. Balances and history are all still there, and the kids' tablet shows balances in read-only mode.",
      cta: "Pick a plan to switch everything back on",
    },
  },
  fr: {
    reminder: {
      subject: (b) => `Plus que 3 jours à votre essai ${b}`,
      title: "Plus que 3 jours",
      body: "Le tableau de vos enfants fonctionne jusqu'à la fin de votre essai. Choisissez un forfait quand vous voulez pour continuer.",
      cta: "Choisir un forfait",
    },
    ended: {
      subject: (b) => `Votre essai ${b} est terminé — vos données sont en sécurité`,
      title: "Votre essai est terminé",
      body: "Rien n'a été supprimé. Les soldes et l'historique sont toujours là, et la tablette des enfants affiche les soldes en lecture seule.",
      cta: "Choisir un forfait pour tout réactiver",
    },
  },
  es: {
    reminder: {
      subject: (b) => `Quedan 3 días de tu prueba de ${b}`,
      title: "Quedan 3 días",
      body: "El tablero de tus hijos sigue funcionando hasta que termine tu prueba. Elige un plan cuando quieras para seguir usándolo.",
      cta: "Elegir un plan",
    },
    ended: {
      subject: (b) => `Tu prueba de ${b} terminó — tus datos están seguros`,
      title: "Tu prueba terminó",
      body: "No se borró nada. Los saldos y el historial siguen ahí, y la tableta de los niños muestra los saldos en modo de solo lectura.",
      cta: "Elige un plan para volver a activar todo",
    },
  },
  pt: {
    reminder: {
      subject: (b) => `Faltam 3 dias no seu teste do ${b}`,
      title: "Faltam 3 dias",
      body: "O quadro das crianças continua funcionando até o fim do seu teste. Escolha um plano quando quiser para continuar.",
      cta: "Escolher um plano",
    },
    ended: {
      subject: (b) => `Seu teste do ${b} terminou — seus dados estão seguros`,
      title: "Seu teste terminou",
      body: "Nada foi apagado. Os saldos e o histórico continuam lá, e o tablet das crianças mostra os saldos no modo somente leitura.",
      cta: "Escolha um plano para reativar tudo",
    },
  },
};

/** Subject + title + inner HTML (wrap with emailLayout). */
export function buildTrialEmail(
  kind: TrialEmailKind,
  locale: Locale,
  input: { brandName: string; billingUrl: string },
): { subject: string; title: string; bodyHtml: string } {
  const c = (copy[locale] ?? copy.en)[kind];
  return {
    subject: c.subject(input.brandName),
    title: escapeHtml(c.title),
    bodyHtml: `<p>${escapeHtml(c.body)}</p><p><a href="${escapeHtml(input.billingUrl)}">${escapeHtml(c.cta)}</a></p>`,
  };
}
