import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n";
import { inviteEmail, paymentFailedEmail } from "./parentEmails";

describe("parent emails", () => {
  const invite = { home: "Casa <Rosa>", inviter: "ana@example.test", brand: "First Payday", link: "https://x.test/invite/abc" };

  it("invite email exists in every language with the link and an escaped home name", () => {
    for (const locale of LOCALES) {
      const e = inviteEmail({ locale, ...invite });
      expect(e.subject).toContain("Casa <Rosa>");
      expect(e.subject).toContain("First Payday");
      expect(e.title).toContain("Casa &lt;Rosa&gt;");
      expect(e.body).toContain(invite.link);
      expect(e.body).toContain("ana@example.test");
    }
    expect(inviteEmail({ locale: "en", ...invite }).subject).toBe("You're invited to Casa <Rosa> on First Payday");
    expect(inviteEmail({ locale: "es", ...invite }).body).toContain("Aceptar invitación");
    expect(inviteEmail({ locale: "pt", ...invite }).body).toContain("Aceitar convite");
    expect(inviteEmail({ locale: "fr", ...invite }).body).toContain("Accepter l&#39;invitation");
  });

  it("payment-failed email exists in every language", () => {
    const billingUrl = "https://x.test/admin/settings/billing";
    for (const locale of LOCALES) {
      const e = paymentFailedEmail({ locale, brand: "First Payday", billingUrl });
      expect(e.subject).toContain("First Payday");
      expect(e.body).toContain(billingUrl);
    }
    expect(paymentFailedEmail({ locale: "en", brand: "First Payday", billingUrl }).subject).toBe("Your First Payday payment didn't go through");
    expect(paymentFailedEmail({ locale: "es", brand: "First Payday", billingUrl }).title).toBe("El pago falló");
  });
});
