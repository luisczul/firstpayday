/**
 * Checklist chores (a chore with subtasks, e.g. a daily routine).
 *
 * chores.subtasks is a JSON array of {id, title, section?}. The kid ticks
 * subtasks on the tablet; ticks live in chore_subtask_checks keyed by the
 * chore's current period (SQL checklist_period_key, migration 019), and the
 * chore can only be submitted once every subtask is ticked. Pure helpers only.
 */

export const MAX_SUBTASKS = 20;
export const MAX_SUBTASK_TITLE = 80;
export const MAX_SECTION_LABEL = 40;
export const SUBTASK_ID = /^[A-Za-z0-9_-]{1,40}$/;

export interface Subtask {
  id: string;
  title: string;
  /** Optional heading the subtask is grouped under ("🌅 Morning"). */
  section?: string | null;
}

export interface ChecklistProgress {
  total: number;
  done: number;
  remaining: number;
  complete: boolean;
  /** Ticked ids that still exist on the chore, in chore order. */
  doneIds: string[];
}

const text = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Tolerant read of chores.subtasks (jsonb): drops malformed or duplicate entries. */
export function parseSubtasks(value: unknown): Subtask[] {
  if (!Array.isArray(value)) return [];
  const out: Subtask[] = [];
  const seen = new Set<string>();
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const { id, title, section } = v as Record<string, unknown>;
    const t = text(title, MAX_SUBTASK_TITLE);
    if (typeof id !== "string" || !SUBTASK_ID.test(id) || seen.has(id) || !t) continue;
    seen.add(id);
    const s = text(section, MAX_SECTION_LABEL);
    out.push(s ? { id, title: t, section: s } : { id, title: t });
    if (out.length === MAX_SUBTASKS) break;
  }
  return out;
}

/**
 * The chore's subtasks with titles and sections from a translation, matched by
 * id. Anything the translation lacks keeps the original text.
 */
export function localizeSubtasks(base: readonly Subtask[], translated: unknown): Subtask[] {
  const byId = new Map(parseSubtasks(translated).map((s) => [s.id, s]));
  return base.map((s) => {
    const t = byId.get(s.id);
    if (!t) return s;
    const section = s.section ? (t.section ?? s.section) : null;
    return section ? { id: s.id, title: t.title, section } : { id: s.id, title: t.title };
  });
}

/** How far along a kid is; only ticks of subtasks that still exist count. */
export function checklistProgress(subtasks: readonly Subtask[], checkedIds: readonly string[]): ChecklistProgress {
  const checked = new Set(checkedIds);
  const doneIds = subtasks.filter((s) => checked.has(s.id)).map((s) => s.id);
  const total = subtasks.length;
  return { total, done: doneIds.length, remaining: total - doneIds.length, complete: total > 0 && doneIds.length === total, doneIds };
}

/** Consecutive subtasks sharing a section form one group (a null section is its own group). */
export function groupSubtasks(subtasks: readonly Subtask[]): { section: string | null; items: Subtask[] }[] {
  const groups: { section: string | null; items: Subtask[] }[] = [];
  for (const s of subtasks) {
    const section = s.section ?? null;
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.items.push(s);
    else groups.push({ section, items: [s] });
  }
  return groups;
}

/** Unique section labels, in order of first appearance. */
export function sectionsOf(subtasks: readonly Subtask[]): string[] {
  return [...new Set(subtasks.map((s) => s.section).filter((s): s is string => Boolean(s)))];
}
