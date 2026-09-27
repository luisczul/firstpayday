import { describe, expect, it } from "vitest";
import { buildBoard, type BoardChoreRow } from "@/lib/board/buildBoard";

const chore = (over: Partial<BoardChoreRow>): BoardChoreRow => ({
  id: "c1",
  title: "Daily routine",
  description: null,
  emoji: "🌞",
  color: null,
  price_cents: 10,
  unit_label: null,
  max_quantity: 1,
  repeat_kind: "daily",
  repeat_every_days: null,
  scope: "per_kid",
  note_for_kids: null,
  available_from: null,
  available_until: null,
  sort_order: 0,
  created_at: "2026-09-01T00:00:00Z",
  category: "organizing",
  assignee_ids: [],
  ...over,
});

describe("buildBoard checklist cards", () => {
  const base = { submissions: [], kidId: "k1", kidLastSeenBoardAt: null, household: { timezone: "America/Toronto", week_starts_on: 0 }, now: new Date("2026-09-26T15:00:00Z") };
  const steps = [
    { id: "bed", title: "Make your bed", section: "🌅 Morning" },
    { id: "teeth", title: "Brush your teeth" },
    { id: "read", title: "Read for 15 minutes" },
  ];

  it("carries the steps and this period's ticks (ignoring removed steps)", () => {
    const board = buildBoard({ ...base, chores: [chore({ subtasks: steps })], checks: { c1: ["teeth", "gone"] } });
    expect(board.ready[0]!.checklist).toEqual({ subtasks: steps, done: ["teeth"] });
  });

  it("plain chores have no checklist; no ticks means nothing done", () => {
    const board = buildBoard({ ...base, chores: [chore({ id: "c2", subtasks: [] }), chore({ id: "c3", subtasks: steps, sort_order: 1 })] });
    expect(board.ready.map((c) => c.checklist)).toEqual([null, { subtasks: steps, done: [] }]);
  });
});
