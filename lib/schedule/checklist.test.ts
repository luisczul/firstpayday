import { describe, expect, it } from "vitest";
import { MAX_SUBTASKS, checklistProgress, groupSubtasks, localizeSubtasks, parseSubtasks, sectionsOf } from "./checklist";

const routine = [
  { id: "bed", title: "Make your bed" },
  { id: "teeth", title: "Brush your teeth" },
  { id: "read", title: "Read for 15 minutes" },
];

describe("parseSubtasks", () => {
  it("keeps valid entries and trims text", () => {
    expect(parseSubtasks([{ id: "a", title: "  Brush  ", section: " 🌅 Morning " }, { id: "b", title: "Read", section: null }])).toEqual([
      { id: "a", title: "Brush", section: "🌅 Morning" },
      { id: "b", title: "Read" },
    ]);
  });

  it("drops junk, bad ids, empty titles and duplicates", () => {
    expect(parseSubtasks(null)).toEqual([]);
    expect(parseSubtasks({ id: "a" })).toEqual([]);
    expect(
      parseSubtasks([null, "x", { id: "bad id", title: "x" }, { id: 3, title: "x" }, { id: "a", title: "  " }, { id: "a", title: "A" }, { id: "a", title: "again" }]),
    ).toEqual([{ id: "a", title: "A" }]);
  });

  it("caps the list and the title length", () => {
    const many = Array.from({ length: MAX_SUBTASKS + 5 }, (_, i) => ({ id: `s${i}`, title: "x".repeat(100) }));
    const out = parseSubtasks(many);
    expect(out).toHaveLength(MAX_SUBTASKS);
    expect(out[0]!.title).toHaveLength(80);
  });
});

describe("localizeSubtasks", () => {
  const sectioned = [
    { id: "teeth", title: "Brush your teeth", section: "🌅 Morning" },
    { id: "bath", title: "Take a bath", section: "🌙 Evening" },
    { id: "extra", title: "Hug the dog" },
  ];

  it("swaps titles and sections by id, keeping the original when missing", () => {
    const fr = [
      { id: "teeth", title: "Brosse-toi les dents", section: "🌅 Matin" },
      { id: "bath", title: "Prends ton bain" },
      { id: "extra", title: "Fais un câlin au chien", section: "ignored" },
    ];
    expect(localizeSubtasks(sectioned, fr)).toEqual([
      { id: "teeth", title: "Brosse-toi les dents", section: "🌅 Matin" },
      { id: "bath", title: "Prends ton bain", section: "🌙 Evening" },
      { id: "extra", title: "Fais un câlin au chien" },
    ]);
  });

  it("returns the original list without a translation", () => {
    expect(localizeSubtasks(routine, undefined)).toEqual(routine);
    expect(localizeSubtasks(routine, [{ id: "bed", title: "Fais ton lit" }])[0]).toEqual({ id: "bed", title: "Fais ton lit" });
  });
});

describe("checklistProgress", () => {
  it("counts only ticks of current subtasks", () => {
    expect(checklistProgress(routine, ["teeth", "gone"])).toEqual({ total: 3, done: 1, remaining: 2, complete: false, doneIds: ["teeth"] });
    expect(checklistProgress(routine, ["read", "bed", "teeth"])).toEqual({
      total: 3,
      done: 3,
      remaining: 0,
      complete: true,
      doneIds: ["bed", "teeth", "read"],
    });
  });

  it("an empty checklist is never complete", () => {
    expect(checklistProgress([], []).complete).toBe(false);
  });
});

describe("groupSubtasks / sectionsOf", () => {
  it("groups consecutive subtasks by section", () => {
    const list = [
      { id: "a", title: "A", section: "Morning" },
      { id: "b", title: "B", section: "Morning" },
      { id: "c", title: "C" },
      { id: "d", title: "D", section: "Evening" },
    ];
    expect(groupSubtasks(list).map((g) => [g.section, g.items.map((i) => i.id)])).toEqual([
      ["Morning", ["a", "b"]],
      [null, ["c"]],
      ["Evening", ["d"]],
    ]);
    expect(sectionsOf(list)).toEqual(["Morning", "Evening"]);
    expect(groupSubtasks([])).toEqual([]);
  });
});
