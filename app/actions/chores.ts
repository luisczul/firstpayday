"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction } from "@/lib/auth/session";
import { seasonWindow } from "@/lib/templates";

const repeat = z
  .object({
    repeat_kind: z.enum(["once", "daily", "weekly", "every_n_days"]),
    repeat_every_days: z.coerce.number().int().min(1).max(365).nullable(),
  })
  .transform((r) => ({ ...r, repeat_every_days: r.repeat_kind === "every_n_days" ? (r.repeat_every_days ?? 7) : null }));

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .or(z.literal("").transform(() => null));

const ChoreInput = z
  .object({
    title: z.string().trim().min(1, "Give the chore a title.").max(80),
    description: z.string().trim().max(400).nullable(),
    emoji: z.string().trim().max(16).nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
    price_cents: z.coerce.number().int().min(0).max(100000),
    unit_label: z.string().trim().max(30).nullable(),
    max_quantity: z.coerce.number().int().min(1).max(20),
    scope: z.enum(["household", "per_kid"]),
    requires_approval: z.boolean(),
    note_for_kids: z.string().trim().max(200).nullable(),
    available_from: dateOrNull,
    available_until: dateOrNull,
    assignee_ids: z.array(z.uuid()).max(20),
  })
  .and(repeat);

export type ChoreFormInput = z.input<typeof ChoreInput>;

async function setAssignees(
  ctx: Awaited<ReturnType<typeof requireWritableParent>>,
  choreId: string,
  kidIds: string[],
) {
  const { error: delError } = await ctx.supabase.from("chore_assignees").delete().eq("chore_id", choreId);
  if (delError) throw delError;
  if (kidIds.length === 0) return;
  const { error } = await ctx.supabase
    .from("chore_assignees")
    .insert(kidIds.map((kid_id) => ({ chore_id: choreId, kid_id, household_id: ctx.household.id })));
  if (error) throw error;
}

function revalidateChores() {
  revalidatePath("/admin/chores");
  revalidatePath("/admin/approvals");
}

export async function saveChore(choreId: string | null, input: ChoreFormInput) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = ChoreInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", parsed.error.issues[0]?.message ?? "Check the form.");
    const { assignee_ids, ...fields } = parsed.data;
    const clean = { ...fields, unit_label: fields.max_quantity > 1 ? fields.unit_label : fields.unit_label || null };

    let id = choreId;
    if (id) {
      const { error } = await ctx.supabase
        .from("chores")
        .update(clean)
        .eq("household_id", ctx.household.id)
        .eq("id", z.uuid().parse(id));
      if (error) throw error;
    } else {
      const { count } = await ctx.supabase
        .from("chores")
        .select("id", { count: "exact", head: true })
        .eq("household_id", ctx.household.id);
      const { data, error } = await ctx.supabase
        .from("chores")
        .insert({ ...clean, household_id: ctx.household.id, sort_order: count ?? 0 })
        .select("id")
        .single();
      if (error) throw error;
      id = data.id;
    }
    await setAssignees(ctx, id, assignee_ids);
    revalidateChores();
    return { id };
  });
}

export async function updateChorePrice(choreId: string, priceCents: number) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const price = z.number().int().min(0).max(100000).parse(priceCents);
    const { error } = await ctx.supabase
      .from("chores")
      .update({ price_cents: price })
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(choreId));
    if (error) throw error;
    revalidateChores();
  });
}

export async function setChoreActive(choreId: string, active: boolean) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const { error } = await ctx.supabase
      .from("chores")
      .update({ active })
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(choreId));
    if (error) throw error;
    revalidateChores();
  });
}

export async function reorderChores(orderedIds: string[]) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const ids = z.array(z.uuid()).max(500).parse(orderedIds);
    await Promise.all(
      ids.map((id, i) =>
        ctx.supabase.from("chores").update({ sort_order: i }).eq("household_id", ctx.household.id).eq("id", id),
      ),
    );
    revalidateChores();
  });
}

export async function duplicateChore(choreId: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const { data: c, error } = await ctx.supabase
      .from("chores")
      .select("*, chore_assignees(kid_id)")
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(choreId))
      .single();
    if (error) throw error;
    const { id: _id, created_at: _c, updated_at: _u, chore_assignees, ...rest } = c;
    const { data: copy, error: insError } = await ctx.supabase
      .from("chores")
      .insert({ ...rest, title: `${rest.title} (copy)`.slice(0, 80), sort_order: rest.sort_order + 1 })
      .select("id")
      .single();
    if (insError) throw insError;
    await setAssignees(ctx, copy.id, chore_assignees.map((a) => a.kid_id));
    revalidateChores();
    return { id: copy.id };
  });
}

/** Hard delete only when the chore has no history (SPEC §8 A2). */
export async function deleteChore(choreId: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const id = z.uuid().parse(choreId);
    const { count } = await ctx.supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("household_id", ctx.household.id)
      .eq("chore_id", id);
    if ((count ?? 0) > 0) {
      throw new ActionError("invalid", "This chore has history, so it can't be deleted. Pause it instead.");
    }
    const { error } = await ctx.supabase.from("chores").delete().eq("household_id", ctx.household.id).eq("id", id);
    if (error) throw error;
    revalidateChores();
  });
}

const TemplatePick = z.object({
  key: z.string().min(1).max(40),
  price_cents: z.number().int().min(0).max(100000),
  repeat_kind: z.enum(["once", "daily", "weekly", "every_n_days"]),
  repeat_every_days: z.number().int().min(1).max(365).nullable(),
});

/** Copy templates into the household (never linked live, SPEC §9). */
export async function addChoresFromTemplates(picks: z.input<typeof TemplatePick>[]) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = z.array(TemplatePick).max(100).parse(picks);
    if (parsed.length === 0) return { added: 0 };
    const { data: templates, error } = await ctx.supabase
      .from("chore_templates")
      .select("*")
      .eq("locale", ctx.household.locale)
      .in("key", parsed.map((p) => p.key));
    if (error) throw error;
    const byKey = new Map(templates.map((t) => [t.key, t]));
    const { count } = await ctx.supabase
      .from("chores")
      .select("id", { count: "exact", head: true })
      .eq("household_id", ctx.household.id);
    const today = new Date();
    const rows = parsed.flatMap((p, i) => {
      const t = byKey.get(p.key);
      if (!t) return [];
      return [
        {
          household_id: ctx.household.id,
          template_key: t.key,
          title: t.title,
          description: t.description,
          emoji: t.emoji,
          price_cents: p.price_cents,
          unit_label: t.unit_label,
          max_quantity: t.max_quantity,
          repeat_kind: p.repeat_kind,
          repeat_every_days: p.repeat_kind === "every_n_days" ? (p.repeat_every_days ?? 7) : null,
          scope: t.scope,
          sort_order: (count ?? 0) + i,
          ...seasonWindow(t.season, today),
        },
      ];
    });
    const { error: insError } = await ctx.supabase.from("chores").insert(rows);
    if (insError) throw insError;
    revalidateChores();
    return { added: rows.length };
  });
}
