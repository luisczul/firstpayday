import type { Locale } from "@/lib/i18n";

// What a parent's phone shows when a kid sends a chore (docs/native/app-api.md).

const TITLE: Record<Locale, (kid: string) => string> = {
  en: (kid) => `${kid} finished a chore`,
  fr: (kid) => `${kid} a terminé une tâche`,
  es: (kid) => `${kid} terminó una tarea`,
  pt: (kid) => `${kid} terminou uma tarefa`,
};

const TITLE_AGAIN: Record<Locale, (kid: string) => string> = {
  en: (kid) => `${kid} fixed a chore`,
  fr: (kid) => `${kid} a corrigé une tâche`,
  es: (kid) => `${kid} corrigió una tarea`,
  pt: (kid) => `${kid} corrigiu uma tarefa`,
};

export interface SubmissionPush {
  title: string;
  body: string;
  badge: number;
  data: { type: "submission"; submissionId: string };
}

export function buildSubmissionPush(input: {
  locale: Locale;
  kidName: string;
  choreTitle: string;
  amount: string;
  pendingCount: number;
  submissionId: string;
  resubmitted: boolean;
}): SubmissionPush {
  const title = (input.resubmitted ? TITLE_AGAIN : TITLE)[input.locale](input.kidName);
  return {
    title,
    body: `${input.choreTitle} · ${input.amount}`,
    badge: Math.max(0, input.pendingCount),
    data: { type: "submission", submissionId: input.submissionId },
  };
}

/** The APNs request body. */
export function apnsBody(p: SubmissionPush) {
  return {
    aps: { alert: { title: p.title, body: p.body }, badge: p.badge, sound: "default", "thread-id": "approvals" },
    ...p.data,
  };
}

/** The FCM HTTP v1 message for one token. */
export function fcmMessage(token: string, p: SubmissionPush) {
  return {
    message: {
      token,
      notification: { title: p.title, body: p.body },
      data: { ...p.data, badge: String(p.badge) },
      android: { priority: "HIGH", notification: { channel_id: "approvals", tag: "approvals" } },
    },
  };
}
