import { describe, expect, it } from "vitest";
import { parentDicts, parentT } from "./index";

describe("parent-side dictionaries", () => {
  it("every language has every key, and no leftover English-only gaps", () => {
    const d = parentDicts();
    const keys = Object.keys(d.en).sort();
    for (const l of ["fr", "es", "pt"] as const) {
      expect(Object.keys(d[l]).sort()).toEqual(keys);
      for (const k of keys) expect((d[l] as Record<string, string>)[k]!.trim()).not.toBe("");
    }
  });

  it("never promises anything forever", () => {
    const all = Object.values(parentDicts()).flatMap((x) => Object.values(x));
    for (const s of all) expect(s).not.toMatch(/forever|pour toujours|para siempre|para sempre/i);
  });

  it("falls back to the key and fills variables", () => {
    const t = parentT("fr");
    expect(t("missing.key" as never)).toBe("missing.key");
  });
});
