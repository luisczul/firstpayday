import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LOCALES } from "@/lib/i18n";
import { buildShareEmail, shareLink } from "./shareEmail";

const base = { senderName: "Nicolle", senderEmail: "nicolle@example.test", baseUrl: "https://firstpayday.app/" };

describe("share email", () => {
  it("is personalized in every language, links to the right site, and says free", () => {
    for (const locale of LOCALES) {
      const e = buildShareEmail({ ...base, locale, note: "See you Saturday!" });
      expect(e.subject).toContain("Nicolle");
      expect(e.subject).toContain("First Payday");
      expect(e.html).toContain("<strong>Nicolle</strong>");
      expect(e.html).toContain("See you Saturday!");
      expect(e.html).toContain("nicolle@example.test");
      expect(e.html).toContain(e.link);
      expect(e.html).toMatch(/free|gratuit|gratis|grátis/);
      expect(`${e.subject} ${e.html}`).not.toMatch(/forever|pour toujours|para siempre|para sempre|\$\d/i);
    }
  });

  it("uses the requested subjects", () => {
    expect(buildShareEmail({ ...base, locale: "en" }).subject).toBe("Nicolle thinks you'll love First Payday");
    expect(buildShareEmail({ ...base, locale: "fr" }).subject).toBe("Nicolle pense que First Payday va vous plaire");
    expect(buildShareEmail({ ...base, locale: "es" }).subject).toBe("Nicolle cree que First Payday te va a encantar");
    expect(buildShareEmail({ ...base, locale: "pt" }).subject).toBe("Nicolle acha que você vai adorar o First Payday");
  });

  it("links English to the root and other languages to their prefix", () => {
    expect(shareLink("https://firstpayday.app/", "en")).toBe("https://firstpayday.app/?ref=share");
    expect(shareLink("https://firstpayday.app", "fr")).toBe("https://firstpayday.app/fr?ref=share");
    expect(shareLink("https://firstpayday.app", "es")).toBe("https://firstpayday.app/es?ref=share");
    expect(shareLink("https://firstpayday.app", "pt")).toBe("https://firstpayday.app/pt?ref=share");
  });

  it("escapes the name and the note, and leaves the note out when empty", () => {
    const e = buildShareEmail({ ...base, locale: "en", senderName: "<b>Eve</b>", note: `<script>alert("x")</script>` });
    expect(e.html).not.toContain("<script>");
    expect(e.html).not.toContain("<b>Eve</b>");
    expect(e.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(e.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    const plain = buildShareEmail({ ...base, locale: "en", note: "   " });
    expect(plain.html).not.toContain("<blockquote");
  });
});
