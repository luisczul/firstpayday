import { requireParent } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { parentChoreStatus } from "@/lib/board/parentStatus";
import type { BoardChoreRow } from "@/lib/board/buildBoard";
import { choreColor } from "@/lib/board/buildBoard";
import { parseSubtasks } from "@/lib/schedule/checklist";
import { ChoresBoard, type AdminChore } from "./ChoresBoard";

export async function generateMetadata() {
  const ctx = await requireParent();
  return { title: parentT(ctx.locale)("b.chores.title") };
}

export default async function ChoresPage() {
  const ctx = await requireParent();
  const hid = ctx.household.id;
  const [{ data: chores }, { data: assignees }, { data: submissions }, { data: kids }, { data: templates }] = await Promise.all([
    ctx.supabase.from("chores").select("*").eq("household_id", hid).order("sort_order").order("created_at"),
    ctx.supabase.from("chore_assignees").select("chore_id, kid_id").eq("household_id", hid),
    ctx.supabase
      .from("submissions")
      .select("id, chore_id, kid_id, status, quantity, amount_cents, chore_title_snapshot, submitted_at, reviewed_at, review_comment")
      .eq("household_id", hid)
      .order("submitted_at", { ascending: false })
      .limit(5000),
    ctx.supabase.from("kids").select("id, name, color, locale").eq("household_id", hid).is("archived_at", null).order("sort_order"),
    ctx.supabase.from("chore_templates").select("*").eq("locale", ctx.household.locale).order("sort_order"),
  ]);

  const byChore = new Map<string, string[]>();
  for (const a of assignees ?? []) byChore.set(a.chore_id, [...(byChore.get(a.chore_id) ?? []), a.kid_id]);
  const subs = (submissions ?? []).map((s) => ({ ...s, status: s.status as "pending" | "approved" | "sent_back" | "rejected" | "reversed" | "withdrawn" }));
  const historyCount = new Map<string, number>();
  for (const s of subs) historyCount.set(s.chore_id, (historyCount.get(s.chore_id) ?? 0) + 1);
  const now = new Date();
  const household = { timezone: ctx.household.timezone, week_starts_on: ctx.household.week_starts_on };

  const items: AdminChore[] = (chores ?? []).map((c) => {
    const row: BoardChoreRow & { active: boolean } = {
      ...c,
      repeat_kind: c.repeat_kind as BoardChoreRow["repeat_kind"],
      scope: c.scope as BoardChoreRow["scope"],
      assignee_ids: byChore.get(c.id) ?? [],
    };
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      emoji: c.emoji,
      color: c.color,
      displayColor: choreColor(c),
      price_cents: c.price_cents,
      unit_label: c.unit_label,
      max_quantity: c.max_quantity,
      repeat_kind: row.repeat_kind,
      repeat_every_days: c.repeat_every_days,
      scope: row.scope,
      category: c.category,
      requires_approval: c.requires_approval,
      note_for_kids: c.note_for_kids,
      available_from: c.available_from,
      available_until: c.available_until,
      active: c.active,
      template_key: c.template_key,
      assignee_ids: row.assignee_ids,
      subtasks: parseSubtasks(c.subtasks),
      hasHistory: (historyCount.get(c.id) ?? 0) > 0,
      status: parentChoreStatus({ chore: row, submissions: subs, kids: kids ?? [], household, now }),
    };
  });

  return (
    <ChoresBoard
      chores={items}
      kids={kids ?? []}
      showTranslate={(kids ?? []).some((k) => k.locale && k.locale !== ctx.household.locale)}
      templates={templates ?? []}
      currency={ctx.household.currency}
      locale={ctx.locale}
      readOnly={ctx.access !== "full"}
    />
  );
}
