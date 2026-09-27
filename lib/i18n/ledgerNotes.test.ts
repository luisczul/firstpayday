import { describe, expect, it } from "vitest";
import { localizeLedgerNote } from "./ledgerNotes";

describe("localizeLedgerNote", () => {
  it("translates the notes written by database functions", () => {
    expect(localizeLedgerNote("Needs a revision: Jefe de la basura", "es")).toBe("Hay que arreglar: Jefe de la basura");
    expect(localizeLedgerNote("Approval reversed: Chef des poubelles", "fr")).toBe("Approbation annulée : Chef des poubelles");
    expect(localizeLedgerNote("Bonus: Chefe do lixo", "pt")).toBe("Bônus: Chefe do lixo");
    expect(localizeLedgerNote("Promotion: Blitz", "es")).toBe("Promoción: Blitz");
    expect(localizeLedgerNote("Family tax 10%", "fr")).toBe("Taxe familiale 10 %");
    expect(localizeLedgerNote("Family tax 10%", "en")).toBe("Family tax 10%");
  });
  it("leaves parent-typed notes alone", () => {
    expect(localizeLedgerNote("Birthday money", "pt")).toBe("Birthday money");
    expect(localizeLedgerNote(null, "fr")).toBeNull();
  });
});
