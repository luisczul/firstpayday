import type { Locale } from "./index";

/** Parent-facing copy for the family tax and promotions, in the household language. */
export interface TaxPromoCopy {
  taxTitle: string;
  taxToggle: string;
  taxRate: string;
  taxWhy: string;
  taxExample: (v: { pct: number; gross: string; tax: string; net: string }) => string;
  taxOnboardingTitle: string;
  saved: string;
  save: string;
  potTitle: string;
  potWhy: string;
  potCollected: string;
  potSpent: string;
  potIdeas: string;
  treatTitle: string;
  treatWhat: string;
  treatPlaceholder: string;
  treatAmount: string;
  treatSave: string;
  treatSaved: string;
  taxOff: string;
  taxOffLink: string;
  gross: string;
  taxLine: (pct: number) => string;
  net: string;
  payNet: (net: string, name: string) => string;
  paid: (net: string, name: string, tax: string) => string;
  taxesPaidBy: string;
  promoNav: string;
  promoTitle: string;
  promoIntro: string;
  promoName: string;
  promoNamePlaceholder: string;
  promoStarts: string;
  promoEnds: string;
  promoDate: string;
  promoTime: string;
  promoBonus: string;
  promoFlat: string;
  promoPercent: string;
  promoAmount: string;
  promoPercentValue: string;
  promoCreate: string;
  promoSaveChanges: string;
  promoCancel: string;
  promoEdit: string;
  promoEndNow: string;
  promoDelete: string;
  promoNone: string;
  promoTz: (tz: string) => string;
  promoStatus: Record<"scheduled" | "active" | "ended", string>;
  promoEndBeforeStart: string;
  promoPerChore: (bonus: string) => string;
  promoOnApproval: (bonus: string, name: string) => string;
  promoUpcoming: string;
  promoPast: string;
}

const en: TaxPromoCopy = {
  taxTitle: "Family tax",
  taxToggle: "Turn on family tax",
  taxRate: "Tax rate",
  taxWhy:
    "Optional. It teaches kids how taxes work, just like in the real world: part of every paycheck goes to things everyone shares. Kids still see everything they earned. When you pay them, a small part is kept back for the family pot.",
  taxExample: ({ pct, gross, tax, net }) => `Example: paying out ${gross} at ${pct}% gives ${net} in hand and ${tax} to the family pot.`,
  taxOnboardingTitle: "Want to teach taxes too? (optional)",
  saved: "Saved",
  save: "Save",
  potTitle: "Family tax pot",
  potWhy:
    "Taxes collected from payouts. Spend it on something the whole family shares, then tell the kids their taxes helped pay for it.",
  potCollected: "Collected",
  potSpent: "Spent on family treats",
  potIdeas: "Ideas: a family dinner, an ice-cream outing together, a new sofa everyone uses.",
  treatTitle: "Record a family treat",
  treatWhat: "What was it?",
  treatPlaceholder: "Ice cream together",
  treatAmount: "Amount",
  treatSave: "Record treat",
  treatSaved: "Recorded! Tell the kids their taxes helped pay for it.",
  taxOff: "Family tax is off.",
  taxOffLink: "Turn it on in Settings",
  gross: "Taken from balance",
  taxLine: (pct) => `Family tax (${pct}%)`,
  net: "In hand",
  payNet: (net, name) => `Pay ${net} to ${name}`,
  paid: (net, name, tax) => `Paid ${net} to ${name}${tax ? ` (${tax} family tax)` : ""}`,
  taxesPaidBy: "Taxes paid",
  promoNav: "Promotions",
  promoTitle: "Promotions",
  promoIntro:
    "Run a bonus window: every chore a kid does during it earns extra, even if you approve it later. If two promotions overlap, the one that pays more for that chore wins (they don't add up).",
  promoName: "Name",
  promoNamePlaceholder: "Saturday blitz",
  promoStarts: "Starts",
  promoEnds: "Ends",
  promoDate: "date",
  promoTime: "time",
  promoBonus: "Bonus per chore",
  promoFlat: "Flat amount",
  promoPercent: "Percent of the chore",
  promoAmount: "Amount",
  promoPercentValue: "Percent",
  promoCreate: "Create promotion",
  promoSaveChanges: "Save changes",
  promoCancel: "Cancel",
  promoEdit: "Edit",
  promoEndNow: "End now",
  promoDelete: "Delete",
  promoNone: "No promotions yet.",
  promoTz: (tz) => `Times are in your household timezone (${tz}).`,
  promoStatus: { scheduled: "Scheduled", active: "Live now", ended: "Ended" },
  promoEndBeforeStart: "The end must be after the start.",
  promoPerChore: (bonus) => `${bonus} per chore`,
  promoOnApproval: (bonus, name) => `+ ${bonus} ${name}`,
  promoUpcoming: "Live and upcoming",
  promoPast: "Recently ended",
};

const fr: TaxPromoCopy = {
  taxTitle: "Taxe familiale",
  taxToggle: "Activer la taxe familiale",
  taxRate: "Taux",
  taxWhy:
    "Facultatif. Les enfants apprennent comment fonctionnent les taxes, comme dans la vraie vie : une partie de chaque paie sert aux choses que tout le monde partage. Les enfants voient toujours tout ce qu'ils ont gagné. Quand vous les payez, une petite partie est gardée pour la cagnotte familiale.",
  taxExample: ({ pct, gross, tax, net }) => `Exemple : un paiement de ${gross} à ${pct} % donne ${net} en main et ${tax} pour la cagnotte familiale.`,
  taxOnboardingTitle: "Envie d'enseigner les taxes aussi? (facultatif)",
  saved: "Enregistré",
  save: "Enregistrer",
  potTitle: "Cagnotte de la taxe familiale",
  potWhy:
    "Les taxes retenues sur les paiements. Dépensez-la pour quelque chose que toute la famille partage, puis dites aux enfants que leurs taxes ont aidé à le payer.",
  potCollected: "Récolté",
  potSpent: "Dépensé en gâteries familiales",
  potIdeas: "Idées : un souper en famille, une sortie à la crèmerie ensemble, un nouveau sofa pour tout le monde.",
  treatTitle: "Noter une gâterie familiale",
  treatWhat: "C'était quoi?",
  treatPlaceholder: "Crème glacée ensemble",
  treatAmount: "Montant",
  treatSave: "Noter la gâterie",
  treatSaved: "C'est noté! Dites aux enfants que leurs taxes ont aidé à la payer.",
  taxOff: "La taxe familiale est désactivée.",
  taxOffLink: "L'activer dans les Paramètres",
  gross: "Retiré du solde",
  taxLine: (pct) => `Taxe familiale (${pct} %)`,
  net: "En main",
  payNet: (net, name) => `Payer ${net} à ${name}`,
  paid: (net, name, tax) => `${net} payé à ${name}${tax ? ` (${tax} de taxe familiale)` : ""}`,
  taxesPaidBy: "Taxes payées",
  promoNav: "Promotions",
  promoTitle: "Promotions",
  promoIntro:
    "Lancez une période bonus : chaque tâche faite pendant cette période rapporte plus, même si vous l'approuvez plus tard. Si deux promotions se chevauchent, celle qui paie le plus pour cette tâche l'emporte (elles ne s'additionnent pas).",
  promoName: "Nom",
  promoNamePlaceholder: "Blitz du samedi",
  promoStarts: "Début",
  promoEnds: "Fin",
  promoDate: "date",
  promoTime: "heure",
  promoBonus: "Bonus par tâche",
  promoFlat: "Montant fixe",
  promoPercent: "Pourcentage de la tâche",
  promoAmount: "Montant",
  promoPercentValue: "Pourcentage",
  promoCreate: "Créer la promotion",
  promoSaveChanges: "Enregistrer",
  promoCancel: "Annuler",
  promoEdit: "Modifier",
  promoEndNow: "Terminer maintenant",
  promoDelete: "Supprimer",
  promoNone: "Aucune promotion pour l'instant.",
  promoTz: (tz) => `Les heures sont dans le fuseau horaire du foyer (${tz}).`,
  promoStatus: { scheduled: "Prévue", active: "En cours", ended: "Terminée" },
  promoEndBeforeStart: "La fin doit être après le début.",
  promoPerChore: (bonus) => `${bonus} par tâche`,
  promoOnApproval: (bonus, name) => `+ ${bonus} ${name}`,
  promoUpcoming: "En cours et à venir",
  promoPast: "Terminées récemment",
};

const es: TaxPromoCopy = {
  taxTitle: "Impuesto familiar",
  taxToggle: "Activar el impuesto familiar",
  taxRate: "Tasa",
  taxWhy:
    "Opcional. Enseña a los niños cómo funcionan los impuestos, como en la vida real: parte de cada sueldo paga cosas que todos compartimos. Los niños siguen viendo todo lo que ganaron. Cuando les pagas, una pequeña parte se guarda para el fondo familiar.",
  taxExample: ({ pct, gross, tax, net }) => `Ejemplo: un pago de ${gross} al ${pct} % da ${net} en mano y ${tax} para el fondo familiar.`,
  taxOnboardingTitle: "¿Quieres enseñar impuestos también? (opcional)",
  saved: "Guardado",
  save: "Guardar",
  potTitle: "Fondo del impuesto familiar",
  potWhy:
    "Los impuestos retenidos de los pagos. Úsalo en algo que toda la familia comparta y cuéntales a los niños que sus impuestos ayudaron a pagarlo.",
  potCollected: "Recaudado",
  potSpent: "Gastado en gustos familiares",
  potIdeas: "Ideas: una cena familiar, salir juntos por un helado, un sofá nuevo para todos.",
  treatTitle: "Registrar un gusto familiar",
  treatWhat: "¿Qué fue?",
  treatPlaceholder: "Helado juntos",
  treatAmount: "Monto",
  treatSave: "Registrar",
  treatSaved: "¡Registrado! Cuéntales a los niños que sus impuestos ayudaron a pagarlo.",
  taxOff: "El impuesto familiar está desactivado.",
  taxOffLink: "Actívalo en Ajustes",
  gross: "Sale del saldo",
  taxLine: (pct) => `Impuesto familiar (${pct} %)`,
  net: "En mano",
  payNet: (net, name) => `Pagar ${net} a ${name}`,
  paid: (net, name, tax) => `Se pagó ${net} a ${name}${tax ? ` (${tax} de impuesto familiar)` : ""}`,
  taxesPaidBy: "Impuestos pagados",
  promoNav: "Promociones",
  promoTitle: "Promociones",
  promoIntro:
    "Crea un periodo de bono: cada tarea hecha durante ese periodo gana extra, aunque la apruebes después. Si dos promociones se cruzan, gana la que paga más por esa tarea (no se suman).",
  promoName: "Nombre",
  promoNamePlaceholder: "Maratón del sábado",
  promoStarts: "Empieza",
  promoEnds: "Termina",
  promoDate: "fecha",
  promoTime: "hora",
  promoBonus: "Bono por tarea",
  promoFlat: "Monto fijo",
  promoPercent: "Porcentaje de la tarea",
  promoAmount: "Monto",
  promoPercentValue: "Porcentaje",
  promoCreate: "Crear promoción",
  promoSaveChanges: "Guardar cambios",
  promoCancel: "Cancelar",
  promoEdit: "Editar",
  promoEndNow: "Terminar ahora",
  promoDelete: "Eliminar",
  promoNone: "Todavía no hay promociones.",
  promoTz: (tz) => `Las horas están en la zona horaria de tu hogar (${tz}).`,
  promoStatus: { scheduled: "Programada", active: "Activa", ended: "Terminada" },
  promoEndBeforeStart: "El final debe ser después del inicio.",
  promoPerChore: (bonus) => `${bonus} por tarea`,
  promoOnApproval: (bonus, name) => `+ ${bonus} ${name}`,
  promoUpcoming: "Activas y próximas",
  promoPast: "Terminadas hace poco",
};

const pt: TaxPromoCopy = {
  taxTitle: "Imposto da família",
  taxToggle: "Ativar o imposto da família",
  taxRate: "Taxa",
  taxWhy:
    "Opcional. Ensina às crianças como os impostos funcionam, como no mundo real: parte de cada salário paga coisas que todos compartilham. As crianças continuam vendo tudo o que ganharam. Quando você paga, uma pequena parte fica guardada no fundo da família.",
  taxExample: ({ pct, gross, tax, net }) => `Exemplo: um pagamento de ${gross} a ${pct}% dá ${net} na mão e ${tax} para o fundo da família.`,
  taxOnboardingTitle: "Quer ensinar sobre impostos também? (opcional)",
  saved: "Salvo",
  save: "Salvar",
  potTitle: "Fundo do imposto da família",
  potWhy:
    "Os impostos retidos dos pagamentos. Use em algo que a família toda compartilha e conte às crianças que os impostos delas ajudaram a pagar.",
  potCollected: "Arrecadado",
  potSpent: "Gasto em mimos da família",
  potIdeas: "Ideias: um jantar em família, um passeio para tomar sorvete juntos, um sofá novo para todos.",
  treatTitle: "Registrar um mimo da família",
  treatWhat: "O que foi?",
  treatPlaceholder: "Sorvete juntos",
  treatAmount: "Valor",
  treatSave: "Registrar",
  treatSaved: "Registrado! Conte às crianças que os impostos delas ajudaram a pagar.",
  taxOff: "O imposto da família está desativado.",
  taxOffLink: "Ative nas Configurações",
  gross: "Sai do saldo",
  taxLine: (pct) => `Imposto da família (${pct}%)`,
  net: "Na mão",
  payNet: (net, name) => `Pagar ${net} para ${name}`,
  paid: (net, name, tax) => `${net} pago para ${name}${tax ? ` (${tax} de imposto da família)` : ""}`,
  taxesPaidBy: "Impostos pagos",
  promoNav: "Promoções",
  promoTitle: "Promoções",
  promoIntro:
    "Crie um período de bônus: cada tarefa feita durante esse período ganha extra, mesmo que você aprove depois. Se duas promoções se sobrepõem, vale a que paga mais por aquela tarefa (elas não se somam).",
  promoName: "Nome",
  promoNamePlaceholder: "Mutirão de sábado",
  promoStarts: "Começa",
  promoEnds: "Termina",
  promoDate: "data",
  promoTime: "hora",
  promoBonus: "Bônus por tarefa",
  promoFlat: "Valor fixo",
  promoPercent: "Porcentagem da tarefa",
  promoAmount: "Valor",
  promoPercentValue: "Porcentagem",
  promoCreate: "Criar promoção",
  promoSaveChanges: "Salvar alterações",
  promoCancel: "Cancelar",
  promoEdit: "Editar",
  promoEndNow: "Encerrar agora",
  promoDelete: "Excluir",
  promoNone: "Nenhuma promoção ainda.",
  promoTz: (tz) => `Os horários estão no fuso horário da sua casa (${tz}).`,
  promoStatus: { scheduled: "Agendada", active: "Ativa agora", ended: "Encerrada" },
  promoEndBeforeStart: "O fim precisa ser depois do começo.",
  promoPerChore: (bonus) => `${bonus} por tarefa`,
  promoOnApproval: (bonus, name) => `+ ${bonus} ${name}`,
  promoUpcoming: "Ativas e próximas",
  promoPast: "Encerradas recentemente",
};

const COPY: Record<Locale, TaxPromoCopy> = { en, fr, es, pt };

export function taxPromoCopy(locale: Locale): TaxPromoCopy {
  return COPY[locale] ?? en;
}
