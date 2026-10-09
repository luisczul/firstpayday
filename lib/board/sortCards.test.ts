import { describe, expect, it } from "vitest";
import { sortCards } from "./sortCards";

const cards = [
  { id: "bed", priceCents: 50, createdAt: "2026-09-01T10:00:00Z", lastDoneAt: "2026-10-08T08:00:00Z" },
  { id: "dog", priceCents: 100, createdAt: "2026-10-05T10:00:00Z", lastDoneAt: null },
  { id: "lock", priceCents: 200, createdAt: "2026-10-09T10:00:00Z", lastDoneAt: null },
  { id: "trash", priceCents: 150, createdAt: "2026-09-20T10:00:00Z", lastDoneAt: "2026-10-09T07:00:00Z" },
];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("sortCards", () => {
  it("keeps the parent's order by default and does not mutate the input", () => {
    expect(ids(sortCards(cards, "parent"))).toEqual(["bed", "dog", "lock", "trash"]);
    sortCards(cards, "asc");
    expect(ids(cards)).toEqual(["bed", "dog", "lock", "trash"]);
  });

  it("sorts by price both ways", () => {
    expect(ids(sortCards(cards, "asc"))).toEqual(["bed", "dog", "trash", "lock"]);
    expect(ids(sortCards(cards, "desc"))).toEqual(["lock", "trash", "dog", "bed"]);
  });

  it("recently added: newest chore first", () => {
    expect(ids(sortCards(cards, "added"))).toEqual(["lock", "dog", "trash", "bed"]);
  });

  it("recently done: latest first, never-done ones after in the parent's order", () => {
    expect(ids(sortCards(cards, "done"))).toEqual(["trash", "bed", "dog", "lock"]);
  });
});
