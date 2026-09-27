import { afterEach, describe, expect, it, vi } from "vitest";
import { CURRENCY_COPY, currencyOptions, isKnownCurrency } from "./currencies";
import { amountInput } from "./format";

afterEach(() => vi.restoreAllMocks());

describe("currencyOptions", () => {
  it("lists the most-used currencies first, then every 2-decimal currency, named in the language", () => {
    const opts = currencyOptions("es");
    expect(opts.slice(0, 3).map((o) => o.code)).toEqual(["CAD", "USD", "EUR"]);
    expect(opts.find((o) => o.code === "CHF")?.label).toMatch(/^CHF · franco suizo/i);
    expect(opts.some((o) => o.code === "JPY")).toBe(false); // no cents: $0.50 chores wouldn't work
    expect(opts.filter((o) => !o.common).length).toBeGreaterThan(50);
    expect(new Set(opts.map((o) => o.code)).size).toBe(opts.length);
  });

  it("falls back to the common list when the runtime can't list currencies", () => {
    vi.spyOn(Intl, "supportedValuesOf").mockImplementation(() => {
      throw new Error("unsupported");
    });
    expect(currencyOptions("en").every((o) => o.common)).toBe(true);
  });

  it("skips codes the runtime can't format", () => {
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue(["CAD", "ZZZ1"] as never);
    expect(currencyOptions("en").some((o) => o.code === "ZZZ1")).toBe(false);
  });

  it("has picker copy in all four languages", () => {
    expect(Object.keys(CURRENCY_COPY).sort()).toEqual(["en", "es", "fr", "pt"]);
  });
});

describe("isKnownCurrency", () => {
  it("accepts real ISO codes only", () => {
    expect(isKnownCurrency("CHF")).toBe(true);
    expect(isKnownCurrency("chf")).toBe(false);
    expect(isKnownCurrency("12")).toBe(false);
  });
});

describe("amountInput", () => {
  it("uses the decimal comma in French and Portuguese", () => {
    expect(amountInput(110, "fr")).toBe("1,10");
    expect(amountInput(110, "pt")).toBe("1,10");
    expect(amountInput(110, "en")).toBe("1.10");
    expect(amountInput(200, "es", true)).toBe("2");
    expect(amountInput(250)).toBe("2.50");
  });
});
