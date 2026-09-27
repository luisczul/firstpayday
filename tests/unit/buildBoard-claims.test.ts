import { describe, expect, it } from "vitest";
import { buildBoard, type BoardChoreRow, type BoardClaimRow, type BoardSubmissionRow } from "@/lib/board/buildBoard";
import { parentChoreStatus } from "@/lib/board/parentStatus";

const chore = (over: Partial<BoardChoreRow>): BoardChoreRow => ({
  id: "garage",
  title: "Garage sweep",
  description: null,
  emoji: "🧹",
  color: null,
  price_cents: 200,
  unit_label: null,
  max_quantity: 1,
  repeat_kind: "every_n_days",
  repeat_every_days: 14,
  scope: "household",
  note_for_kids: null,
  available_from: null,
  available_until: null,
  sort_order: 0,
  created_at: "2026-09-01T00:00:00Z",
  category: "car_garage",
  assignee_ids: [],
  ...over,
});

const now = new Date("2026-09-26T19:00:00Z");
const household = { timezone: "America/Toronto", week_starts_on: 0 };
const base = { submissions: [] as BoardSubmissionRow[], kidLastSeenBoardAt: now.toISOString(), household, now };
const claim = (over: Partial<BoardClaimRow>): BoardClaimRow => ({
  id: "cl1",
  chore_id: "garage",
  kid_id: "liam",
  kid_name: "Liam",
  quantity: 1,
  expires_at: "2026-09-26T21:15:00Z",
  released_at: null,
  ...over,
});

describe("buildBoard claims overlay", () => {
  const chores = [
    chore({}),
    chore({ id: "bins", title: "Garbage boss", sort_order: 1 }),
    chore({ id: "bed", title: "Make your bed", scope: "per_kid", sort_order: 2 }),
    chore({ id: "routine", title: "Routine", subtasks: [{ id: "a", title: "A" }], sort_order: 3 }),
  ];

  it("free whole-house chores are claimable; each-kid chores and routines are not", () => {
    const board = buildBoard({ ...base, chores, kidId: "liam" });
    expect(board.inProgress).toEqual([]);
    expect(board.ready.map((c) => [c.choreId, c.claimable, c.claim])).toEqual([
      ["garage", true, null],
      ["bins", true, null],
      ["bed", false, null],
      ["routine", false, null],
    ]);
  });

  it("my claim moves the card to In progress with its deadline and quantity", () => {
    const board = buildBoard({ ...base, chores, kidId: "liam", claims: [claim({ quantity: 2 })] });
    expect(board.inProgress.map((c) => c.choreId)).toEqual(["garage"]);
    expect(board.inProgress[0]!.claim).toEqual({ id: "cl1", kidId: "liam", kidName: "Liam", mine: true, quantity: 2, expiresAt: "2026-09-26T21:15:00Z" });
    expect(board.inProgress[0]!.claimable).toBe(false);
    expect(board.ready.map((c) => c.choreId)).toEqual(["bins", "bed", "routine"]);
  });

  it("a sibling's claim keeps the card in place, locked", () => {
    const board = buildBoard({ ...base, chores, kidId: "camila", claims: [claim({})] });
    expect(board.inProgress).toEqual([]);
    const garage = board.ready.find((c) => c.choreId === "garage")!;
    expect(garage.claimable).toBe(false);
    expect(garage.claim).toMatchObject({ mine: false, kidName: "Liam" });
  });

  it("a locked chore that's New stays in New", () => {
    const board = buildBoard({ ...base, kidLastSeenBoardAt: null, chores: [chore({ created_at: "2026-09-26T12:00:00Z" })], kidId: "camila", claims: [claim({})] });
    expect(board.new[0]!.claim?.mine).toBe(false);
  });

  it("expired or released claims are ignored: the chore is free again", () => {
    for (const c of [claim({ expires_at: "2026-09-26T18:59:00Z" }), claim({ released_at: "2026-09-26T18:00:00Z" })]) {
      const board = buildBoard({ ...base, chores, kidId: "camila", claims: [c] });
      expect(board.ready.find((x) => x.choreId === "garage")).toMatchObject({ claimable: true, claim: null });
      const mine = buildBoard({ ...base, chores, kidId: "liam", claims: [c] });
      expect(mine.inProgress).toEqual([]);
    }
  });

  it("claims on chores that aren't available (or can't be claimed) change nothing", () => {
    const done: BoardSubmissionRow = {
      id: "s1", chore_id: "garage", kid_id: "camila", status: "pending", quantity: 1, amount_cents: 200,
      chore_title_snapshot: "Garage sweep", submitted_at: "2026-09-26T18:00:00Z", reviewed_at: null, review_comment: null,
    };
    const board = buildBoard({ ...base, submissions: [done], chores, kidId: "liam", claims: [claim({}), claim({ id: "cl2", chore_id: "bed" })] });
    expect(board.inProgress).toEqual([]);
    expect(board.soon.map((c) => c.choreId)).toEqual(["garage"]);
    expect(board.ready.find((c) => c.choreId === "bed")!.claim).toBeNull();
  });

  it("In progress: soonest deadline first", () => {
    const board = buildBoard({
      ...base,
      chores,
      kidId: "liam",
      claims: [claim({}), claim({ id: "cl2", chore_id: "bins", expires_at: "2026-09-26T20:00:00Z" })],
    });
    expect(board.inProgress.map((c) => c.choreId)).toEqual(["bins", "garage"]);
  });
});

describe("parentChoreStatus with claims", () => {
  const kids = [{ id: "liam", name: "Liam" }, { id: "camila", name: "Camila" }];
  const row = { ...chore({}), active: true };

  it("shows who is on it until when", () => {
    expect(parentChoreStatus({ chore: row, submissions: [], kids, household, now, claims: [claim({})] })).toEqual({
      kind: "claimed",
      claimId: "cl1",
      kidName: "Liam",
      expiresAt: "2026-09-26T21:15:00Z",
    });
  });

  it("an unknown kid shows an empty name; expired or other chores' claims are ignored", () => {
    expect(parentChoreStatus({ chore: row, submissions: [], kids, household, now, claims: [claim({ kid_id: "gone" })] })).toMatchObject({ kind: "claimed", kidName: "" });
    expect(parentChoreStatus({ chore: row, submissions: [], kids, household, now, claims: [claim({ expires_at: "2026-09-26T18:00:00Z" })] })).toEqual({ kind: "available" });
    expect(parentChoreStatus({ chore: row, submissions: [], kids, household, now, claims: [claim({ chore_id: "bins" })] })).toEqual({ kind: "available" });
    expect(parentChoreStatus({ chore: { ...row, scope: "per_kid" }, submissions: [], kids, household, now, claims: [claim({})] })).toEqual({ kind: "available" });
    expect(parentChoreStatus({ chore: row, submissions: [], kids, household, now })).toEqual({ kind: "available" });
  });
});
