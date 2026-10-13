import { describe, expect, it } from "vitest";
import { EmailInput } from "./email";

describe("EmailInput", () => {
  it("trims a space typed before or after the email", () => {
    expect(EmailInput.parse(" parent@example.com")).toBe("parent@example.com");
    expect(EmailInput.parse("parent@example.com  ")).toBe("parent@example.com");
  });
  it("still rejects things that aren't emails", () => {
    expect(EmailInput.safeParse("parent example.com").success).toBe(false);
    expect(EmailInput.safeParse("   ").success).toBe(false);
  });
});
