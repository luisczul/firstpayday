import { describe, expect, it } from "vitest";
import {
  CLAIM_WINDOWS,
  MAX_ACTIVE_CLAIMS,
  asClaimWindow,
  claimDeadline,
  claimTimeLeft,
  isClaimActive,
  isClaimableChore,
} from "./claims";

const TZ = "America/Toronto";
// 2026-09-26 15:00 in Toronto (EDT, UTC-4).
const now = new Date("2026-09-26T19:00:00Z");

describe("claim windows", () => {
  it("knows the five time limits and defaults to 24 hours", () => {
    expect(CLAIM_WINDOWS).toEqual(["2h", "4h", "end_of_day", "24h", "48h"]);
    expect(asClaimWindow("2h")).toBe("2h");
    expect(asClaimWindow("end_of_day")).toBe("end_of_day");
    expect(asClaimWindow("forever")).toBe("24h");
    expect(asClaimWindow(null)).toBe("24h");
    expect(asClaimWindow(undefined)).toBe("24h");
    expect(MAX_ACTIVE_CLAIMS).toBe(2);
  });
});

describe("isClaimActive (lazy expiry)", () => {
  it("is active until released or its time is up", () => {
    expect(isClaimActive({ expires_at: "2026-09-26T21:00:00Z", released_at: null }, now)).toBe(true);
    expect(isClaimActive({ expires_at: new Date("2026-09-26T21:00:00Z"), released_at: null }, now)).toBe(true);
    expect(isClaimActive({ expires_at: "2026-09-26T21:00:00Z", released_at: "2026-09-26T18:00:00Z" }, now)).toBe(false);
    // Exactly at the deadline it's over (the database uses expires_at > now()).
    expect(isClaimActive({ expires_at: now, released_at: null }, now)).toBe(false);
    expect(isClaimActive({ expires_at: "2026-09-26T18:59:00Z", released_at: null }, now)).toBe(false);
  });
});

describe("isClaimableChore", () => {
  it("only whole-house chores without steps", () => {
    expect(isClaimableChore({ scope: "household" })).toBe(true);
    expect(isClaimableChore({ scope: "household", subtasks: [] })).toBe(true);
    expect(isClaimableChore({ scope: "household", subtasks: "junk" })).toBe(true);
    expect(isClaimableChore({ scope: "household", subtasks: [{ id: "a", title: "A" }] })).toBe(false);
    expect(isClaimableChore({ scope: "per_kid" })).toBe(false);
  });
});

describe("claimTimeLeft (countdown)", () => {
  it("hours and minutes, rounded up to the minute", () => {
    expect(claimTimeLeft("2026-09-26T21:15:00Z", now)).toEqual({ hours: 2, minutes: 15, urgent: false });
    expect(claimTimeLeft(new Date("2026-09-26T21:14:30Z"), now)).toEqual({ hours: 2, minutes: 15, urgent: false });
    expect(claimTimeLeft("2026-09-27T19:00:00Z", now)).toEqual({ hours: 24, minutes: 0, urgent: false });
  });

  it("turns urgent in the last hour and never goes below zero", () => {
    expect(claimTimeLeft("2026-09-26T20:01:00Z", now).urgent).toBe(false);
    expect(claimTimeLeft("2026-09-26T20:00:00Z", now)).toEqual({ hours: 1, minutes: 0, urgent: true });
    expect(claimTimeLeft("2026-09-26T19:40:00Z", now)).toEqual({ hours: 0, minutes: 40, urgent: true });
    expect(claimTimeLeft("2026-09-26T19:00:10Z", now)).toEqual({ hours: 0, minutes: 1, urgent: true });
    expect(claimTimeLeft("2026-09-26T18:00:00Z", now)).toEqual({ hours: 0, minutes: 0, urgent: true });
  });
});

describe("claimDeadline (until …)", () => {
  it("the next local midnight is 'the end of the day'", () => {
    expect(claimDeadline("2026-09-27T04:00:00Z", now, "en-CA", TZ)).toEqual({ kind: "end_of_day" });
    // Same instant is not midnight in Vancouver.
    expect(claimDeadline("2026-09-27T04:00:00Z", now, "en-CA", "America/Vancouver").kind).toBe("today");
  });

  it("later today: the time in the kid's language and the household timezone", () => {
    const d = claimDeadline("2026-09-27T01:00:00Z", now, "en-CA", TZ);
    expect(d).toEqual({ kind: "today", time: expect.stringMatching(/^9:00\s?p\.m\.$/) });
    const fr = claimDeadline("2026-09-27T01:00:00Z", now, "fr-CA", TZ);
    expect(fr).toEqual({ kind: "today", time: expect.stringMatching(/^21 h 00$/) });
  });

  it("another day: weekday and time", () => {
    const d = claimDeadline("2026-09-27T19:00:00Z", now, "en-CA", TZ);
    expect(d.kind).toBe("later");
    expect(d).toMatchObject({ weekday: "Sun", time: expect.stringMatching(/^3:00\s?p\.m\.$/) });
  });
});
