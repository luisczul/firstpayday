import { describe, expect, it } from "vitest";
import { instantToZonedDateTime, zonedDateTimeToInstant } from "./tz";

describe("wall-clock date + time in the household timezone", () => {
  it("round-trips through a timezone, across DST", () => {
    const at = zonedDateTimeToInstant("2026-09-26", "18:00", "America/Toronto");
    expect(at.toISOString()).toBe("2026-09-26T22:00:00.000Z"); // EDT = UTC-4
    expect(instantToZonedDateTime(at, "America/Toronto")).toEqual({ date: "2026-09-26", time: "18:00" });
    const winter = zonedDateTimeToInstant("2026-12-01", "00:30", "America/Toronto");
    expect(winter.toISOString()).toBe("2026-12-01T05:30:00.000Z"); // EST = UTC-5
    expect(instantToZonedDateTime(winter, "America/Toronto")).toEqual({ date: "2026-12-01", time: "00:30" });
    expect(instantToZonedDateTime(new Date("2026-09-26T22:00:00Z"), "Europe/Paris")).toEqual({ date: "2026-09-27", time: "00:00" });
  });
});
