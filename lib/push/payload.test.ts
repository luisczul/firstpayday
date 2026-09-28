import { describe, expect, it } from "vitest";
import { apnsBody, buildSubmissionPush, fcmMessage } from "./payload";

const base = { kidName: "Liam", choreTitle: "Clean two bins", amount: "$1.00", pendingCount: 3, submissionId: "s1", resubmitted: false };

describe("submission push", () => {
  it("speaks the parent's language", () => {
    expect(buildSubmissionPush({ ...base, locale: "en" }).title).toBe("Liam finished a chore");
    expect(buildSubmissionPush({ ...base, locale: "fr" }).title).toBe("Liam a terminé une tâche");
    expect(buildSubmissionPush({ ...base, locale: "es" }).title).toBe("Liam terminó una tarea");
    expect(buildSubmissionPush({ ...base, locale: "pt" }).title).toBe("Liam terminou uma tarefa");
    expect(buildSubmissionPush({ ...base, locale: "fr", resubmitted: true }).title).toBe("Liam a corrigé une tâche");
    expect(buildSubmissionPush({ ...base, locale: "en", resubmitted: true }).title).toBe("Liam fixed a chore");
  });

  it("builds APNs and FCM bodies", () => {
    const p = buildSubmissionPush({ ...base, locale: "en", pendingCount: -1 });
    expect(p.body).toBe("Clean two bins · $1.00");
    expect(apnsBody(p)).toEqual({
      aps: { alert: { title: "Liam finished a chore", body: "Clean two bins · $1.00" }, badge: 0, sound: "default", "thread-id": "approvals" },
      type: "submission",
      submissionId: "s1",
    });
    expect(fcmMessage("tok", p).message).toMatchObject({
      token: "tok",
      data: { type: "submission", submissionId: "s1", badge: "0" },
      android: { notification: { channel_id: "approvals" } },
    });
  });
});
