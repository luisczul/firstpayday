import { comingBack, getChoreState, type ScheduleHousehold } from "@/lib/schedule/getChoreState";
import type { BoardChoreRow, BoardSubmissionRow } from "./buildBoard";

export type ParentChoreStatus =
  | { kind: "paused" }
  | { kind: "available" }
  | { kind: "waiting"; count: number }
  | { kind: "cooldown"; days: number; lastKidName: string | null; lastDate: string }
  | { kind: "done" }
  | { kind: "out_of_season"; startsAt: string | null };

/** Live status line for a chore card in Admin → Chores (SPEC §8 A2). */
export function parentChoreStatus(input: {
  chore: BoardChoreRow & { active: boolean };
  submissions: readonly BoardSubmissionRow[];
  kids: readonly { id: string; name: string }[];
  household: ScheduleHousehold;
  now: Date;
}): ParentChoreStatus {
  const { chore, submissions, kids, household, now } = input;
  if (!chore.active) return { kind: "paused" };
  const mine = submissions.filter((s) => s.chore_id === chore.id);
  const waiting = mine.filter((s) => s.status === "pending").length;
  if (waiting > 0) return { kind: "waiting", count: waiting };

  const eligible = chore.assignee_ids.length ? kids.filter((k) => chore.assignee_ids.includes(k.id)) : kids;
  const states = eligible.map((k) => getChoreState(chore, mine, k.id, now, household));
  if (states.length === 0 || states.some((s) => s.state === "available" || s.state === "needs_fixing")) {
    return { kind: "available" };
  }
  if (states.every((s) => s.state === "done_forever")) return { kind: "done" };
  const season = states.find((s) => s.state === "out_of_season");
  if (season) return { kind: "out_of_season", startsAt: season.availableAt?.toISOString() ?? null };

  const soonest = states
    .filter((s) => s.availableAt)
    .sort((a, b) => a.availableAt!.getTime() - b.availableAt!.getTime())[0];
  if (!soonest?.availableAt) return { kind: "done" };
  const back = comingBack(soonest.availableAt, now, household.timezone);
  const last = soonest.latestRelevant;
  return {
    kind: "cooldown",
    days: back.kind === "days" ? back.days : back.kind === "tomorrow" ? 1 : Math.max(1, Math.round((soonest.availableAt.getTime() - now.getTime()) / 86_400_000)),
    lastKidName: last ? (kids.find((k) => k.id === last.kid_id)?.name ?? null) : null,
    lastDate: last?.submitted_at ?? now.toISOString(),
  };
}
