import { describe, expect, it } from "vitest";
import { buildTrialEmail } from "./trialEmail";
import { LOCALES } from "@/lib/i18n";

const input = { brandName: "First Payday", billingUrl: "https://firstpayday.app/admin/settings/billing" };

describe("buildTrialEmail", () => {
  it("has a reminder and an ended email in every language", () => {
    for (const l of LOCALES) {
      for (const kind of ["reminder", "ended"] as const) {
        const e = buildTrialEmail(kind, l, input);
        expect(e.subject).toContain("First Payday");
        expect(e.bodyHtml).toContain(input.billingUrl);
      }
    }
  });

  it("speaks Spanish and Portuguese", () => {
    expect(buildTrialEmail("reminder", "es", input).subject).toBe("Quedan 3 días de tu prueba de First Payday");
    expect(buildTrialEmail("ended", "pt", input).title).toBe("Seu teste terminou");
    expect(buildTrialEmail("reminder", "en", input).subject).toBe("3 days left in your First Payday trial");
  });
});
