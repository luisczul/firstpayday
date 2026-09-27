import { describe, expect, it } from "vitest";
import {
  REVIEW_EMAIL_WINDOW_MS,
  buildReviewEmail,
  isDueForReviewEmail,
  pickReviewRecipients,
  safeAdminNext,
  throttleCutoff,
  type ReviewMember,
} from "./reviewEmail";

const now = new Date("2026-09-26T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const m = (over: Partial<ReviewMember> = {}): ReviewMember => ({
  user_id: "u1",
  role: "parent",
  review_emails_enabled: true,
  review_email_sent_at: null,
  ...over,
});

describe("review email recipients", () => {
  it("emails opted-in owners and parents never emailed", () => {
    expect(isDueForReviewEmail(m({ role: "owner" }), now)).toBe(true);
    expect(isDueForReviewEmail(m({ role: "parent" }), now)).toBe(true);
  });

  it("respects the opt-out and ignores unknown roles", () => {
    expect(isDueForReviewEmail(m({ review_emails_enabled: false }), now)).toBe(false);
    expect(isDueForReviewEmail(m({ role: "kid" }), now)).toBe(false);
  });

  it("throttles to one email per window", () => {
    expect(isDueForReviewEmail(m({ review_email_sent_at: ago(60_000) }), now)).toBe(false);
    expect(isDueForReviewEmail(m({ review_email_sent_at: ago(REVIEW_EMAIL_WINDOW_MS - 1) }), now)).toBe(false);
    expect(isDueForReviewEmail(m({ review_email_sent_at: ago(REVIEW_EMAIL_WINDOW_MS) }), now)).toBe(true);
    expect(isDueForReviewEmail(m({ review_email_sent_at: "garbage" }), now)).toBe(true);
  });

  it("picks only due members, per parent", () => {
    const members = [
      m({ user_id: "owner", role: "owner" }),
      m({ user_id: "recent", review_email_sent_at: ago(5 * 60_000) }),
      m({ user_id: "off", review_emails_enabled: false }),
      m({ user_id: "stale", review_email_sent_at: ago(60 * 60_000) }),
    ];
    expect(pickReviewRecipients(members, now).map((x) => x.user_id)).toEqual(["owner", "stale"]);
  });

  it("cutoff is now minus the window", () => {
    expect(throttleCutoff(now)).toBe("2026-09-26T11:50:00.000Z");
  });
});

describe("safeAdminNext", () => {
  it("allows admin paths only", () => {
    expect(safeAdminNext("/admin/approvals")).toBe("/admin/approvals");
    expect(safeAdminNext("/admin")).toBe("/admin");
    expect(safeAdminNext("/admin?x=1")).toBe("/admin?x=1");
    for (const bad of [null, "", "/", "/administrator", "//evil.com", "/\\evil.com", "https://evil.com/admin", "/admin//evil.com", "/admin/\\evil"]) {
      expect(safeAdminNext(bad)).toBe("/admin");
    }
  });
});

describe("buildReviewEmail", () => {
  const base = {
    kidName: "Cami <b>",
    choreTitle: "Dishes & pots",
    amount: "$2.00",
    when: "Sat 8:00 a.m.",
    resubmitted: false,
    pendingCount: 1,
    reviewUrl: "https://firstpayday.app/auth/confirm?token_hash=abc&type=magiclink&next=%2Fadmin%2Fapprovals",
    loginUrl: "https://firstpayday.app/login",
  };

  it("English, single chore, escaped", () => {
    const e = buildReviewEmail({ ...base, locale: "en" });
    expect(e.subject).toBe("Cami <b> finished a chore — ready for review");
    expect(e.title).toContain("Cami &lt;b&gt;");
    expect(e.bodyHtml).toContain("Dishes &amp; pots");
    expect(e.bodyHtml).toContain("Review now");
    expect(e.bodyHtml).toContain("token_hash=abc&amp;type=magiclink");
    expect(e.bodyHtml).toContain("1 hour");
    expect(e.bodyHtml).not.toContain("waiting for review in total");
  });

  it("French, several waiting, resubmitted", () => {
    const e = buildReviewEmail({ ...base, locale: "fr", pendingCount: 4, resubmitted: true });
    expect(e.subject).toBe("4 tâches à vérifier");
    expect(e.title).toContain("a corrigé");
    expect(e.bodyHtml).toContain("Vérifier maintenant");
    expect(e.bodyHtml).toContain("4 tâches attendent");
  });

  it("Spanish, single chore", () => {
    const e = buildReviewEmail({ ...base, locale: "es" });
    expect(e.subject).toBe("Cami <b> terminó una tarea — lista para revisar");
    expect(e.title).toContain("¡Lo hice!");
    expect(e.bodyHtml).toContain("Revisar ahora");
    expect(e.bodyHtml).toContain("Dishes &amp; pots");
  });

  it("Portuguese, several waiting, resubmitted", () => {
    const e = buildReviewEmail({ ...base, locale: "pt", pendingCount: 3, resubmitted: true });
    expect(e.subject).toBe("3 tarefas esperando conferência");
    expect(e.title).toContain("arrumou uma tarefa");
    expect(e.bodyHtml).toContain("Conferir agora");
    expect(e.bodyHtml).toContain("Ao todo, 3 tarefas");
  });
});
