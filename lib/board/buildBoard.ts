import { emojiColor } from "@/lib/emojiColors";
import { checklistProgress, parseSubtasks, type Subtask } from "@/lib/schedule/checklist";
import { isClaimActive, isClaimableChore } from "@/lib/schedule/claims";
import {
  comingBack,
  getChoreState,
  isComingSoon,
  isNew,
  type ChoreScope,
  type ChoreStateName,
  type ComingBack,
  type RepeatKind,
  type ScheduleHousehold,
  type SubmissionStatus,
} from "@/lib/schedule/getChoreState";

export interface BoardChoreRow {
  id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  price_cents: number;
  unit_label: string | null;
  max_quantity: number;
  repeat_kind: RepeatKind;
  repeat_every_days: number | null;
  scope: ChoreScope;
  note_for_kids: string | null;
  available_from: string | null;
  available_until: string | null;
  sort_order: number;
  created_at: string;
  category: string;
  template_key?: string | null;
  translations?: unknown;
  /** Checklist steps (chores.subtasks jsonb); empty for a plain chore. */
  subtasks?: unknown;
  assignee_ids: string[];
}

export interface BoardSubmissionRow {
  id: string;
  chore_id: string;
  kid_id: string;
  status: SubmissionStatus;
  quantity: number;
  amount_cents: number;
  chore_title_snapshot: string;
  submitted_at: string;
  reviewed_at: string | null;
  review_comment: string | null;
}

export interface BoardCard {
  choreId: string;
  title: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  priceCents: number;
  unitLabel: string | null;
  maxQuantity: number;
  noteForKids: string | null;
  category: string;
  state: ChoreStateName;
  isNew: boolean;
  availableAt: string | null;
  comingBack: ComingBack | null;
  submission: {
    id: string;
    quantity: number;
    amountCents: number;
    reviewComment: string | null;
    submittedAt: string;
  } | null;
  /** Echoed back on submit for optimistic concurrency (kiosk_create_submission). */
  expectedLastId: string | null;
  /** Checklist chore: its steps and the ones this kid ticked this period. */
  checklist: { subtasks: Subtask[]; done: string[] } | null;
  /** A free whole-house chore this kid can claim ("I'm on it!"). */
  claimable: boolean;
  /** Someone said "I'm on it!": this kid (In progress) or a sibling (locked card). */
  claim: BoardCardClaim | null;
}

export interface BoardCardClaim {
  id: string;
  kidId: string;
  kidName: string;
  mine: boolean;
  /** Units taken (1 for a chore without a quantity). */
  quantity: number;
  expiresAt: string;
}

/** A row of chore_claims (with the kid's name) as the kiosk loads it. */
export interface BoardClaimRow {
  id: string;
  chore_id: string;
  kid_id: string;
  kid_name: string;
  quantity: number;
  expires_at: string;
  released_at: string | null;
}

export interface BoardSections {
  /** Whole-house chores this kid claimed ("I'm on it!"), soonest deadline first. */
  inProgress: BoardCard[];
  new: BoardCard[];
  fix: BoardCard[];
  ready: BoardCard[];
  waiting: BoardCard[];
  soon: BoardCard[];
}

const PALETTE = ["#B8431F", "#E08A1E", "#6B7A2E", "#7A3B4A", "#C9962B"];

/** Stripe color: driven by the card's icon; stable fallback when a chore has none. */
export function choreColor(chore: Pick<BoardChoreRow, "id" | "color" | "emoji">): string {
  const fromIcon = emojiColor(chore.emoji);
  if (fromIcon) return fromIcon;
  if (chore.color) return chore.color;
  let h = 0;
  for (const ch of chore.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

function toCard(
  chore: BoardChoreRow,
  state: ReturnType<typeof getChoreState<BoardSubmissionRow>>,
  opts: { isNew: boolean; now: Date; timeZone: string; checked?: readonly string[] },
): BoardCard {
  const sub = state.submission;
  const steps = parseSubtasks(chore.subtasks);
  return {
    choreId: chore.id,
    title: chore.title,
    description: chore.description,
    emoji: chore.emoji,
    color: choreColor(chore),
    priceCents: chore.price_cents,
    unitLabel: chore.unit_label,
    maxQuantity: chore.max_quantity,
    noteForKids: chore.note_for_kids,
    category: chore.category,
    state: state.state,
    isNew: opts.isNew,
    availableAt: state.availableAt?.toISOString() ?? null,
    comingBack: state.availableAt ? comingBack(state.availableAt, opts.now, opts.timeZone) : null,
    submission: sub
      ? {
          id: sub.id,
          quantity: sub.quantity,
          amountCents: sub.amount_cents,
          reviewComment: sub.review_comment,
          submittedAt: sub.submitted_at,
        }
      : null,
    expectedLastId: state.latestRelevant?.id ?? null,
    checklist: steps.length ? { subtasks: steps, done: checklistProgress(steps, opts.checked ?? []).doneIds } : null,
    claimable: false,
    claim: null,
  };
}

/** Sort chores into the five kid-board rows (SPEC §6 K2). */
export function buildBoard(input: {
  chores: readonly BoardChoreRow[];
  submissions: readonly BoardSubmissionRow[];
  kidId: string;
  kidLastSeenBoardAt: string | null;
  household: ScheduleHousehold;
  now: Date;
  /** Checklist ticks for the current period, by chore id. */
  checks?: Readonly<Record<string, readonly string[]>>;
  /** Claims of the household; released or expired ones are ignored. */
  claims?: readonly BoardClaimRow[];
}): BoardSections {
  const { chores, submissions, kidId, household, now } = input;
  const byChore = new Map<string, BoardSubmissionRow[]>();
  for (const s of submissions) {
    const list = byChore.get(s.chore_id);
    if (list) list.push(s);
    else byChore.set(s.chore_id, [s]);
  }

  const claimByChore = new Map<string, BoardClaimRow>();
  for (const c of input.claims ?? []) if (isClaimActive(c, now)) claimByChore.set(c.chore_id, c);

  const sections: BoardSections = { inProgress: [], new: [], fix: [], ready: [], waiting: [], soon: [] };
  const sorted = [...chores].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  const choreById = new Map(sorted.map((c) => [c.id, c]));

  for (const chore of sorted) {
    const state = getChoreState(
      { ...chore, assignee_ids: chore.assignee_ids },
      byChore.get(chore.id) ?? [],
      kidId,
      now,
      household,
    );
    const fresh = isNew(state, now, input.kidLastSeenBoardAt);
    const card = toCard(chore, state, { isNew: fresh, now, timeZone: household.timezone, checked: input.checks?.[chore.id] });
    switch (state.state) {
      case "needs_fixing":
        sections.fix.push(card);
        break;
      case "available": {
        const claimable = isClaimableChore(chore);
        const claim = claimable ? claimByChore.get(chore.id) : undefined;
        if (claim) {
          const mine = claim.kid_id === kidId;
          card.claim = { id: claim.id, kidId: claim.kid_id, kidName: claim.kid_name, mine, quantity: claim.quantity, expiresAt: claim.expires_at };
          // Mine: "In progress" at the top. A sibling's: stays in place, locked.
          if (mine) {
            sections.inProgress.push(card);
            break;
          }
        } else {
          card.claimable = claimable;
        }
        (fresh ? sections.new : sections.ready).push(card);
        break;
      }
      case "cooldown":
      case "out_of_season":
        if (isComingSoon(state, now)) sections.soon.push(card);
        break;
      default:
        // pending → shown under "waiting" below; done_forever / not_assigned hidden.
        break;
    }
  }

  // "Waiting for check": every pending submission of this kid, newest first.
  const pending = submissions
    .filter((s) => s.kid_id === kidId && s.status === "pending" && choreById.has(s.chore_id))
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  for (const s of pending) {
    const chore = choreById.get(s.chore_id)!;
    sections.waiting.push({
      ...toCard(chore, { state: "pending", submission: s }, { isNew: false, now, timeZone: household.timezone }),
      title: s.chore_title_snapshot,
    });
  }

  sections.soon.sort((a, b) => (a.availableAt ?? "").localeCompare(b.availableAt ?? ""));
  sections.inProgress.sort((a, b) => a.claim!.expiresAt.localeCompare(b.claim!.expiresAt));
  return sections;
}
