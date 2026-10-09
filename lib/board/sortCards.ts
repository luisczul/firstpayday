/**
 * Board and chore-list ordering. "parent" keeps the order the parent set; price sorts cheapest or
 * biggest first; "added" shows the newest chores first; "done" shows the most recently done first,
 * then the never-done ones in the parent's order.
 */
export type CardSort = "parent" | "asc" | "desc" | "added" | "done";

export interface Sortable {
  priceCents: number;
  createdAt: string;
  lastDoneAt: string | null;
}

export function sortCards<T extends Sortable>(cards: readonly T[], sort: CardSort): T[] {
  const list = [...cards];
  switch (sort) {
    case "parent":
      return list;
    case "asc":
      return list.sort((a, b) => a.priceCents - b.priceCents);
    case "desc":
      return list.sort((a, b) => b.priceCents - a.priceCents);
    case "added":
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "done":
      // Array.prototype.sort is stable: never-done chores keep the parent's order at the end.
      return list.sort((a, b) => (b.lastDoneAt ?? "").localeCompare(a.lastDoneAt ?? ""));
  }
}
