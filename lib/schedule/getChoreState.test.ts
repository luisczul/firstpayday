import { describe, expect, it } from "vitest";
import {
  comingBack,
  getChoreState,
  isComingSoon,
  isNew,
  nextAvailableAt,
  type ScheduleChore,
  type ScheduleHousehold,
  type ScheduleSubmission,
} from "./getChoreState";
import { addDays, dayOfWeek, daysBetween, localDateOf, parseLocalDate, startOfLocalDay } from "./tz";

const TZ = "America/Toronto";
const hh: ScheduleHousehold = { timezone: TZ, week_starts_on: 1 };
const A = "kid-a";
const B = "kid-b";

/** Local Toronto wall-clock → instant. */
const at = (local: string) => startOfLocalDay(parseLocalDate(local.slice(0, 10)), TZ).getTime() +
  (local.length > 10 ? timeMs(local.slice(11)) : 0);
function timeMs(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h! * 60 + m!) * 60_000;
}
const d = (local: string) => new Date(at(local));

function chore(over: Partial<ScheduleChore> = {}): ScheduleChore {
  return {
    id: "c1",
    created_at: d("2026-09-01"),
    repeat_kind: "every_n_days",
    repeat_every_days: 14,
    scope: "household",
    available_from: null,
    available_until: null,
    assignee_ids: [],
    ...over,
  };
}

let n = 0;
function sub(over: Partial<ScheduleSubmission> & { submitted_at: string | Date }): ScheduleSubmission {
  n += 1;
  return { id: `s${String(n).padStart(3, "0")}`, chore_id: "c1", kid_id: A, status: "pending", ...over };
}

describe("tz helpers", () => {
  it("computes local dates, weekdays and day differences", () => {
    expect(localDateOf(new Date("2026-09-27T03:30:00Z"), TZ)).toEqual({ year: 2026, month: 9, day: 26 });
    expect(dayOfWeek({ year: 2026, month: 9, day: 28 })).toBe(1); // Monday
    expect(daysBetween({ year: 2026, month: 2, day: 27 }, { year: 2026, month: 3, day: 2 })).toBe(3);
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
  });

  it("returns local midnight across DST", () => {
    // EDT (UTC-4) before Nov 1 2026, EST (UTC-5) after.
    expect(startOfLocalDay({ year: 2026, month: 10, day: 31 }, TZ).toISOString()).toBe("2026-10-31T04:00:00.000Z");
    expect(startOfLocalDay({ year: 2026, month: 11, day: 2 }, TZ).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
});

describe("nextAvailableAt", () => {
  it("once never comes back on its own", () => {
    expect(nextAvailableAt({ repeat_kind: "once", repeat_every_days: null }, d("2026-09-26T15:00"), hh)).toBeNull();
  });

  it("daily → next local midnight", () => {
    expect(nextAvailableAt({ repeat_kind: "daily", repeat_every_days: null }, d("2026-09-26T23:59"), hh))
      .toEqual(d("2026-09-27"));
  });

  it("daily just after midnight still waits for the next midnight", () => {
    expect(nextAvailableAt({ repeat_kind: "daily", repeat_every_days: null }, d("2026-09-26T00:01"), hh))
      .toEqual(d("2026-09-27"));
  });

  it("weekly → start of next week (Monday)", () => {
    // Sat Sep 26 → Mon Sep 28
    expect(nextAvailableAt({ repeat_kind: "weekly", repeat_every_days: null }, d("2026-09-26T10:00"), hh))
      .toEqual(d("2026-09-28"));
    // Mon Sep 28 → Mon Oct 5
    expect(nextAvailableAt({ repeat_kind: "weekly", repeat_every_days: null }, d("2026-09-28T08:00"), hh))
      .toEqual(d("2026-10-05"));
  });

  it("weekly honours week_starts_on = Sunday", () => {
    expect(
      nextAvailableAt({ repeat_kind: "weekly", repeat_every_days: null }, d("2026-09-26T10:00"), {
        timezone: TZ,
        week_starts_on: 0,
      }),
    ).toEqual(d("2026-09-27"));
  });

  it("every_n_days → +N days rounded down to local midnight", () => {
    expect(nextAvailableAt({ repeat_kind: "every_n_days", repeat_every_days: 14 }, d("2026-09-26T16:30"), hh))
      .toEqual(d("2026-10-10"));
  });

  it("every_n_days across the DST fall-back lands on local midnight", () => {
    const next = nextAvailableAt({ repeat_kind: "every_n_days", repeat_every_days: 14 }, d("2026-10-25T20:00"), hh)!;
    expect(next).toEqual(d("2026-11-08"));
    expect(next.toISOString()).toBe("2026-11-08T05:00:00.000Z");
  });

  it("every_n_days across the DST spring-forward lands on local midnight", () => {
    const next = nextAvailableAt({ repeat_kind: "every_n_days", repeat_every_days: 3 }, d("2026-03-07T12:00"), hh)!;
    expect(next.toISOString()).toBe("2026-03-10T04:00:00.000Z");
  });

  it("every_n_days with a missing N falls back to 1 day", () => {
    expect(nextAvailableAt({ repeat_kind: "every_n_days", repeat_every_days: null }, d("2026-09-26T16:30"), hh))
      .toEqual(d("2026-09-27"));
  });

  it("uses the household timezone, not UTC", () => {
    // 11pm in Toronto is already the next day in UTC.
    const late = d("2026-09-26T23:00");
    expect(late.toISOString().slice(0, 10)).toBe("2026-09-27");
    expect(nextAvailableAt({ repeat_kind: "daily", repeat_every_days: null }, late, hh)).toEqual(d("2026-09-27"));
  });
});

describe("getChoreState — basics", () => {
  it("is available when never done, new since creation", () => {
    const s = getChoreState(chore(), [], A, d("2026-09-26T10:00"), hh);
    expect(s.state).toBe("available");
    expect(s.becameAvailableAt).toEqual(d("2026-09-01"));
    expect(s.latestRelevant).toBeUndefined();
  });

  it("accepts ISO strings for created_at", () => {
    const s = getChoreState(chore({ created_at: "2026-09-01T12:00:00Z" }), [], A, d("2026-09-26"), hh);
    expect(s.becameAvailableAt).toEqual(new Date("2026-09-01T12:00:00Z"));
  });

  it("hides chores assigned to other kids", () => {
    expect(getChoreState(chore({ assignee_ids: [B] }), [], A, d("2026-09-26"), hh).state).toBe("not_assigned");
    expect(getChoreState(chore({ assignee_ids: [A, B] }), [], A, d("2026-09-26"), hh).state).toBe("available");
  });

  it("ignores submissions of other chores", () => {
    const s = getChoreState(chore(), [sub({ chore_id: "other", submitted_at: d("2026-09-26T09:00") })], A, d("2026-09-26T10:00"), hh);
    expect(s.state).toBe("available");
  });
});

describe("getChoreState — repeating chores", () => {
  it("own pending submission → pending (card leaves Ready right away)", () => {
    const p = sub({ submitted_at: d("2026-09-26T09:00") });
    const s = getChoreState(chore(), [p], A, d("2026-09-26T09:01"), hh);
    expect(s.state).toBe("pending");
    expect(s.submission).toBe(p);
    expect(s.availableAt).toEqual(d("2026-10-10"));
  });

  it("household scope: a sibling's tap puts the card in cooldown for everyone", () => {
    const p = sub({ kid_id: B, submitted_at: d("2026-09-26T09:00") });
    const s = getChoreState(chore(), [p], A, d("2026-09-26T09:01"), hh);
    expect(s.state).toBe("cooldown");
    expect(s.availableAt).toEqual(d("2026-10-10"));
    expect(s.latestRelevant).toBe(p);
  });

  it("per_kid scope: a sibling's tap does not affect me", () => {
    const p = sub({ kid_id: B, submitted_at: d("2026-09-26T09:00") });
    const s = getChoreState(chore({ scope: "per_kid" }), [p], A, d("2026-09-26T09:01"), hh);
    expect(s.state).toBe("available");
    expect(s.latestRelevant).toBeUndefined();
  });

  it("per_kid scope: my own tap starts my cooldown", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-09-26T09:00") });
    const s = getChoreState(chore({ scope: "per_kid", repeat_kind: "weekly", repeat_every_days: null }), [p], A, d("2026-09-27"), hh);
    expect(s.state).toBe("cooldown");
    expect(s.availableAt).toEqual(d("2026-09-28"));
  });

  it("approved → cooldown until the next window, then available and New", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-09-26T16:00") });
    const during = getChoreState(chore(), [p], A, d("2026-10-09T23:59"), hh);
    expect(during.state).toBe("cooldown");
    const after = getChoreState(chore(), [p], A, d("2026-10-10T00:00"), hh);
    expect(after.state).toBe("available");
    expect(after.becameAvailableAt).toEqual(d("2026-10-10"));
    expect(isNew(after, d("2026-10-10T07:00"), null)).toBe(true);
  });

  it("rejected repeating chores still cool down (no farming)", () => {
    const p = sub({ status: "rejected", submitted_at: d("2026-09-26T09:00") });
    expect(getChoreState(chore(), [p], A, d("2026-09-27"), hh).state).toBe("cooldown");
  });

  it("an old unreviewed pending doesn't block once the cooldown has passed", () => {
    const p = sub({ submitted_at: d("2026-09-25T09:00") });
    const s = getChoreState(chore({ repeat_kind: "daily", repeat_every_days: null }), [p], A, d("2026-09-26T08:00"), hh);
    expect(s.state).toBe("available");
    expect(s.latestRelevant).toBe(p);
  });

  it("the newest relevant submission wins, with id as the tie-break", () => {
    const t = d("2026-09-26T09:00");
    const older = sub({ status: "approved", submitted_at: d("2026-09-01T09:00") });
    const x = sub({ kid_id: B, status: "approved", submitted_at: t, id: "s-a" });
    const y = sub({ kid_id: B, status: "approved", submitted_at: t, id: "s-b" });
    expect(getChoreState(chore(), [x, older, y], A, d("2026-09-27"), hh).latestRelevant).toBe(y);
    expect(getChoreState(chore(), [y, x, older], A, d("2026-09-27"), hh).latestRelevant).toBe(y);
  });

  it("chore created after its cooldown ended is new from created_at", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-08-01T09:00") });
    const s = getChoreState(chore({ created_at: d("2026-09-20") }), [p], A, d("2026-09-26"), hh);
    expect(s.becameAvailableAt).toEqual(d("2026-09-20"));
  });
});

describe("getChoreState — sent back", () => {
  it("my sent-back submission → needs_fixing with the comment", () => {
    const p = sub({ status: "sent_back", review_comment: "Missed a spot", submitted_at: d("2026-09-26T09:00") });
    const s = getChoreState(chore(), [p], A, d("2026-09-26T12:00"), hh);
    expect(s.state).toBe("needs_fixing");
    expect(s.submission?.review_comment).toBe("Missed a spot");
  });

  it("still needs fixing after the cooldown would have ended", () => {
    const p = sub({ status: "sent_back", submitted_at: d("2026-09-01T09:00") });
    expect(getChoreState(chore(), [p], A, d("2026-09-26"), hh).state).toBe("needs_fixing");
  });

  it("a sibling's sent-back card is in cooldown for me (from the first tap)", () => {
    const p = sub({ kid_id: B, status: "sent_back", submitted_at: d("2026-09-26T09:00") });
    const s = getChoreState(chore(), [p], A, d("2026-09-26T12:00"), hh);
    expect(s.state).toBe("cooldown");
    expect(s.availableAt).toEqual(d("2026-10-10"));
  });
});

describe("getChoreState — once", () => {
  const once = chore({ repeat_kind: "once", repeat_every_days: null });

  it("available until approved, then done forever", () => {
    expect(getChoreState(once, [], A, d("2026-09-26"), hh).state).toBe("available");
    const p = sub({ status: "approved", submitted_at: d("2026-09-26T09:00") });
    const s = getChoreState(once, [p], A, d("2026-12-01"), hh);
    expect(s.state).toBe("done_forever");
    expect(s.submission).toBe(p);
  });

  it("my pending once-chore is pending", () => {
    const p = sub({ submitted_at: d("2026-09-26T09:00") });
    expect(getChoreState(once, [p], A, d("2026-09-26T10:00"), hh).state).toBe("pending");
  });

  it("a sibling's pending once-chore is taken (cooldown with no return date)", () => {
    const p = sub({ kid_id: B, submitted_at: d("2026-09-26T09:00") });
    const s = getChoreState(once, [p], A, d("2026-09-26T10:00"), hh);
    expect(s.state).toBe("cooldown");
    expect(s.availableAt).toBeUndefined();
    expect(isComingSoon(s, d("2026-09-26T10:00"))).toBe(false);
  });

  it("rejected once-chores become available again, new from the rejection", () => {
    const p = sub({ status: "rejected", submitted_at: d("2026-09-26T09:00"), reviewed_at: d("2026-09-26T18:00") });
    const s = getChoreState(once, [p], A, d("2026-09-27"), hh);
    expect(s.state).toBe("available");
    expect(s.becameAvailableAt).toEqual(d("2026-09-26T18:00"));
  });

  it("rejected without reviewed_at falls back to submitted_at", () => {
    const p = sub({ status: "rejected", submitted_at: d("2026-09-26T09:00"), reviewed_at: null });
    expect(getChoreState(once, [p], A, d("2026-09-27"), hh).becameAvailableAt).toEqual(d("2026-09-26T09:00"));
  });

  it("per_kid once: each kid does it once", () => {
    const perKid = chore({ repeat_kind: "once", repeat_every_days: null, scope: "per_kid" });
    const p = sub({ kid_id: B, status: "approved", submitted_at: d("2026-09-26T09:00") });
    expect(getChoreState(perKid, [p], A, d("2026-09-27"), hh).state).toBe("available");
    expect(getChoreState(perKid, [p], B, d("2026-09-27"), hh).state).toBe("done_forever");
  });
});

describe("getChoreState — seasonal window", () => {
  const fall = { available_from: "2026-09-15", available_until: "2026-11-30" };

  it("available inside the window, new from the window start", () => {
    const s = getChoreState(chore(fall), [], A, d("2026-09-16"), hh);
    expect(s.state).toBe("available");
    expect(s.becameAvailableAt).toEqual(d("2026-09-15"));
  });

  it("before the window: out of season with the start date; coming soon within 14 days", () => {
    const s = getChoreState(chore(fall), [], A, d("2026-09-05"), hh);
    expect(s.state).toBe("out_of_season");
    expect(s.availableAt).toEqual(d("2026-09-15"));
    expect(isComingSoon(s, d("2026-09-05"))).toBe(true);
    expect(isComingSoon(getChoreState(chore(fall), [], A, d("2026-08-01"), hh), d("2026-08-01"))).toBe(false);
  });

  it("the last day is inclusive; the day after is out of season", () => {
    expect(getChoreState(chore(fall), [], A, d("2026-11-30T20:00"), hh).state).toBe("available");
    const after = getChoreState(chore(fall), [], A, d("2026-12-01"), hh);
    expect(after.state).toBe("out_of_season");
    expect(after.availableAt).toBeUndefined();
  });

  it("cooldown that runs past the end of the season is out of season", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-11-25T10:00") });
    expect(getChoreState(chore(fall), [p], A, d("2026-11-26"), hh).state).toBe("out_of_season");
  });

  it("cooldown inside the season stays a cooldown", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-10-01T10:00") });
    const s = getChoreState(chore(fall), [p], A, d("2026-10-02"), hh);
    expect(s.state).toBe("cooldown");
    expect(s.availableAt).toEqual(d("2026-10-15"));
  });

  it("cooldown ending before the window opens waits for the window", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-09-01T10:00") });
    const s = getChoreState(chore({ available_from: "2026-10-01", available_until: null }), [p], A, d("2026-09-20"), hh);
    expect(s.state).toBe("out_of_season");
    expect(s.availableAt).toEqual(d("2026-10-01"));
  });

  it("cooldown ending after the window opens returns at the cooldown end", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-09-25T10:00") });
    const s = getChoreState(chore({ available_from: "2026-09-26", available_until: null }), [p], A, d("2026-09-25T12:00"), hh);
    expect(s.state).toBe("out_of_season");
    expect(s.availableAt).toEqual(d("2026-10-09"));
  });

  it("a window that ends before the start is reachable is out of season with no date", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-09-25T10:00") });
    const s = getChoreState(chore({ available_from: "2026-09-26", available_until: "2026-09-30" }), [p], A, d("2026-09-25T12:00"), hh);
    expect(s.state).toBe("out_of_season");
    expect(s.availableAt).toBeUndefined();
  });

  it("once chores respect the window too", () => {
    const s = getChoreState(chore({ repeat_kind: "once", repeat_every_days: null, ...fall }), [], A, d("2026-12-05"), hh);
    expect(s.state).toBe("out_of_season");
  });

  it("an until-only window has no start adjustment", () => {
    const s = getChoreState(chore({ available_until: "2026-12-31" }), [], A, d("2026-09-26"), hh);
    expect(s.state).toBe("available");
    expect(s.becameAvailableAt).toEqual(d("2026-09-01"));
  });
});

describe("isNew", () => {
  const now = d("2026-09-26T12:00");

  it("only available cards can be new", () => {
    expect(isNew({ state: "cooldown", becameAvailableAt: now }, now, null)).toBe(false);
    expect(isNew({ state: "available" }, now, null)).toBe(false);
  });

  it("new within 72 hours", () => {
    expect(isNew({ state: "available", becameAvailableAt: d("2026-09-23T12:00") }, now, null)).toBe(true);
    expect(isNew({ state: "available", becameAvailableAt: d("2026-09-23T11:59") }, now, null)).toBe(false);
  });

  it("or new since the kid last opened the board", () => {
    const became = d("2026-09-20");
    expect(isNew({ state: "available", becameAvailableAt: became }, now, d("2026-09-19"))).toBe(true);
    expect(isNew({ state: "available", becameAvailableAt: became }, now, "2026-09-21T00:00:00Z")).toBe(false);
  });

  it("never new if it becomes available in the future", () => {
    expect(isNew({ state: "available", becameAvailableAt: d("2026-09-27") }, now, null)).toBe(false);
  });
});

describe("comingBack / isComingSoon", () => {
  const now = d("2026-09-26T15:00"); // Saturday

  it("tomorrow, weekday, or days", () => {
    expect(comingBack(d("2026-09-27"), now, TZ)).toEqual({ kind: "tomorrow" });
    expect(comingBack(d("2026-09-28"), now, TZ)).toEqual({ kind: "weekday", weekday: 1 });
    expect(comingBack(d("2026-10-10"), now, TZ)).toEqual({ kind: "days", days: 14 });
  });

  it("never says less than one day", () => {
    expect(comingBack(d("2026-09-26T18:00"), now, TZ)).toEqual({ kind: "tomorrow" });
  });

  it("every cooldown with a date is coming soon; available cards are not", () => {
    expect(isComingSoon({ state: "cooldown", availableAt: d("2026-12-25") }, now)).toBe(true);
    expect(isComingSoon({ state: "available", availableAt: d("2026-09-27") }, now)).toBe(false);
  });
});

describe("acceptance: baseboards (SPEC §15)", () => {
  it("2 floors → pending, approved → back in 14 days → New at local midnight on day 14", () => {
    const baseboards = chore({ id: "bb" });
    const tap = d("2026-09-26T16:00");
    const p = sub({ chore_id: "bb", submitted_at: tap });
    expect(getChoreState(baseboards, [p], A, tap, hh).state).toBe("pending");

    const approved = { ...p, status: "approved" as const };
    const next = getChoreState(baseboards, [approved], A, d("2026-09-26T19:00"), hh);
    expect(next.state).toBe("cooldown");
    expect(comingBack(next.availableAt!, d("2026-09-26T19:00"), TZ)).toEqual({ kind: "days", days: 14 });

    const back = getChoreState(baseboards, [approved], A, d("2026-10-10T00:00"), hh);
    expect(back.state).toBe("available");
    expect(isNew(back, d("2026-10-10T07:00"), d("2026-10-01"))).toBe(true);
  });
});

describe("getChoreState — undo and 'Make available now'", () => {
  it("a reversed approval doesn't count: the chore is available again", () => {
    const r = sub({ status: "reversed", submitted_at: d("2026-09-26T09:00") });
    const s = getChoreState(chore(), [r], A, d("2026-09-26T12:00"), hh);
    expect(s.state).toBe("available");
    expect(s.latestRelevant).toBeUndefined();
  });

  it("a reversed once-chore can be done again", () => {
    const once = chore({ repeat_kind: "once", repeat_every_days: null });
    const r = sub({ status: "reversed", submitted_at: d("2026-09-26T09:00") });
    expect(getChoreState(once, [r], A, d("2026-09-27"), hh).state).toBe("available");
  });

  it("Make available now ends a cooldown and marks the card new from that moment", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-09-26T09:00") });
    const reset = d("2026-09-27T10:00");
    const s = getChoreState(chore({ reset_at: reset }), [p], A, d("2026-09-27T11:00"), hh);
    expect(s.state).toBe("available");
    expect(s.becameAvailableAt).toEqual(reset);
    // Without the reset it would still be resting.
    expect(getChoreState(chore(), [p], A, d("2026-09-27T11:00"), hh).state).toBe("cooldown");
  });

  it("Make available now brings back a done once-chore", () => {
    const once = chore({ repeat_kind: "once", repeat_every_days: null, reset_at: "2026-10-01T12:00:00Z" });
    const p = sub({ status: "approved", submitted_at: d("2026-09-26T09:00") });
    expect(getChoreState(once, [p], A, d("2026-10-02"), hh).state).toBe("available");
  });

  it("a reset keeps work that's still open (pending, sent back)", () => {
    const pending = sub({ status: "pending", submitted_at: d("2026-09-26T09:00") });
    const reset = chore({ reset_at: d("2026-09-27T10:00") });
    expect(getChoreState(reset, [pending], A, d("2026-09-27T11:00"), hh).state).toBe("pending");
    const back = sub({ status: "sent_back", submitted_at: d("2026-09-26T09:00") });
    expect(getChoreState(reset, [back], A, d("2026-09-27T11:00"), hh).state).toBe("needs_fixing");
  });

  it("work done after the reset counts normally", () => {
    const p = sub({ status: "approved", submitted_at: d("2026-09-27T12:00") });
    const s = getChoreState(chore({ reset_at: d("2026-09-27T10:00") }), [p], A, d("2026-09-27T13:00"), hh);
    expect(s.state).toBe("cooldown");
  });
});

describe("getChoreState — a kid gives up a sent-back chore", () => {
  it("a withdrawn chore is free again, for everyone", () => {
    const w = sub({ kid_id: B, status: "withdrawn", submitted_at: d("2026-09-26T09:00") });
    expect(getChoreState(chore(), [w], A, d("2026-09-26T12:00"), hh).state).toBe("available");
    expect(getChoreState(chore(), [w], B, d("2026-09-26T12:00"), hh).state).toBe("available");
  });
});
