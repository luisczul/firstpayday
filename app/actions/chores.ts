"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction } from "@/lib/auth/session";
import { seasonWindow } from "@/lib/templates";
import { choreTextFor, translateChoreText, type ChoreText, type ChoreTranslations } from "@/lib/translate";
import type { Json } from "@/lib/supabase/database.types";
import { LOCALES, asLocale, isLocale, type Locale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";
import { zodErrorMessage } from "@/lib/i18n/parent/zodError";
import { MAX_SECTION_LABEL, MAX_SUBTASKS, MAX_SUBTASK_TITLE, SUBTASK_ID, parseSubtasks, type Subtask } from "@/lib/schedule/checklist";

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

/** Checklist steps; a new step has no id yet (one is made on save). */
const SubtaskInput = z.object({
  id: z.string().regex(SUBTASK_ID).nullish(),
  title: z.string().trim().min(1, "b.err.stepText").max(MAX_SUBTASK_TITLE),
  section: z.string().trim().max(MAX_SECTION_LABEL).nullish(),
});

const ChoreInput = z
  .object({
    title: z.string().trim().min(1, "b.err.choreTitle").max(80),
    description: z.string().trim().max(400).nullable(),
    emoji: z.string().trim().max(16).nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
    price_cents: z.coerce.number().int().min(0).max(100000),
    unit_label: z.string().trim().max(30).nullable(),
    max_quantity: z.coerce.number().int().min(1).max(20),
    scope: z.enum(["household", "per_kid"]),
    category: z.enum(["car_garage", "outdoor", "kitchen", "cleaning", "laundry", "organizing", "other"]),
    requires_approval: z.boolean(),
    note_for_kids: z.string().trim().max(200).nullable(),
    available_from: dateOrNull,
    available_until: dateOrNull,
    assignee_ids: z.array(z.uuid()).max(20),
    subtasks: z.array(SubtaskInput).max(MAX_SUBTASKS, "b.err.maxSteps").optional(),
    /** A new chore started from a template (its ready-made translations are reused when the text is unchanged). */
    template_key: z.string().min(1).max(40).nullish(),
  })
  .and(repeat);

/** Stable ids (kept on edit so ticks survive a rename), sections trimmed to null when blank. */
function withIds(steps: z.infer<typeof SubtaskInput>[]): Subtask[] {
  const used = new Set<string>();
  return steps.map((s) => {
    let id = s.id ?? null;
    while (!id || used.has(id)) id = `s${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    used.add(id);
    return s.section ? { id, title: s.title, section: s.section } : { id, title: s.title };
  });
}

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
    if (!parsed.success) throw new ActionError("invalid", zodErrorMessage(ctx.locale, parsed.error.issues, { n: MAX_SUBTASKS }));
    const { assignee_ids, subtasks: steps, template_key: templateKey, ...rest } = parsed.data;
    const subtasks = withIds(steps ?? []);
    // A checklist is done by each kid on their own, once per period.
    const fields = subtasks.length ? { ...rest, scope: "per_kid" as const, max_quantity: 1, unit_label: null } : rest;
    const clean = { ...fields, subtasks, unit_label: fields.max_quantity > 1 ? fields.unit_label : fields.unit_label || null };

    // Both languages are saved: whatever the parent typed (English or French)
    // is translated so each kid reads it in their own board language, and the
    // parent's copy stays in the household language.
    const text: ChoreText = {
      title: clean.title,
      description: clean.description || null,
      unit_label: clean.unit_label || null,
      note_for_kids: clean.note_for_kids || null,
      ...(subtasks.length ? { subtasks } : {}),
    };
    let translations: ChoreTranslations = {};
    let existing: { title: string; description: string | null; unit_label: string | null; note_for_kids: string | null; subtasks: Json; translations: Json } | null = null;
    if (choreId) {
      const { data } = await ctx.supabase
        .from("chores")
        .select("title, description, unit_label, note_for_kids, subtasks, translations")
        .eq("household_id", ctx.household.id)
        .eq("id", z.uuid().parse(choreId))
        .maybeSingle();
      existing = data;
    }
    const unchanged =
      existing &&
      existing.title === text.title &&
      (existing.description || null) === text.description &&
      (existing.unit_label || null) === text.unit_label &&
      (existing.note_for_kids || null) === text.note_for_kids &&
      JSON.stringify(parseSubtasks(existing.subtasks)) === JSON.stringify(subtasks) &&
      existing.translations &&
      // Re-translate older chores that predate a language (e.g. es/pt added later).
      LOCALES.every((l) => choreTextFor(existing!.translations, l));
    const fromTemplate = !choreId && templateKey ? await templateTranslations(ctx, templateKey, text) : null;
    if (unchanged) {
      translations = existing!.translations as ChoreTranslations;
    } else if (fromTemplate) {
      translations = fromTemplate;
    }
    // New or edited text: save right away, translate with Claude in the background.
    const translateLater = !unchanged && !fromTemplate;

    let id = choreId;
    if (id) {
      const { error } = await ctx.supabase
        .from("chores")
        .update({ ...clean, subtasks: clean.subtasks as unknown as { [k: string]: Json }[], translations: translations as unknown as { [k: string]: Json } })
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
        .insert({
          ...clean,
          subtasks: clean.subtasks as unknown as { [k: string]: Json }[],
          translations: translations as unknown as { [k: string]: Json },
          household_id: ctx.household.id,
          sort_order: count ?? 0,
          ...(templateKey ? { template_key: templateKey } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;
      id = data.id;
    }
    await setAssignees(ctx, id, assignee_ids);
    revalidateChores();
    if (translateLater) {
      const choreKey = id;
      const householdId = ctx.household.id;
      const householdLocale = asLocale(ctx.household.locale);
      // After the response: the parent never waits on Claude, and a Claude outage never blocks a save.
      after(() => translateSavedChore(householdId, choreKey, householdLocale, text));
    }
    return { id };
  });
}

/**
 * Store all four languages for a just-saved chore. The parent's copy switches to the household
 * language only if the chore still has the exact text that was translated (no newer edit).
 */
async function translateSavedChore(householdId: string, choreId: string, householdLocale: Locale, text: ChoreText) {
  const t = await translateChoreText(text);
  if (!t) return;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("chores")
    .select("title, description")
    .eq("household_id", householdId)
    .eq("id", choreId)
    .maybeSingle();
  if (!row || row.title !== text.title || (row.description || null) !== (text.description || null)) return;
  const mine = t[householdLocale];
  await admin
    .from("chores")
    .update({
      ...(mine
        ? {
            title: mine.title,
            description: mine.description,
            unit_label: mine.unit_label,
            note_for_kids: mine.note_for_kids,
            ...(mine.subtasks ? { subtasks: mine.subtasks as unknown as { [k: string]: Json }[] } : {}),
          }
        : {}),
      translations: t as unknown as { [k: string]: Json },
    })
    .eq("household_id", householdId)
    .eq("id", choreId);
  revalidatePath("/admin/chores");
}

/**
 * The template's own four-language text, when the parent kept its words (price, repeat and
 * so on may change). Null when the text was edited, so it gets translated like any chore.
 */
async function templateTranslations(
  ctx: Awaited<ReturnType<typeof requireWritableParent>>,
  key: string,
  text: ChoreText,
): Promise<ChoreTranslations | null> {
  const { data: rows } = await ctx.supabase.from("chore_templates").select("*").eq("key", key);
  const mine = rows?.find((t) => t.locale === ctx.household.locale);
  if (!rows || !mine) return null;
  const same =
    mine.title === text.title &&
    (mine.description || null) === text.description &&
    (mine.unit_label || null) === text.unit_label &&
    !text.note_for_kids &&
    JSON.stringify(parseSubtasks(mine.subtasks)) === JSON.stringify(text.subtasks ?? []);
  if (!same) return null;
  const out: ChoreTranslations = {};
  for (const t of rows) {
    if (!isLocale(t.locale)) continue;
    const steps = parseSubtasks(t.subtasks);
    out[t.locale] = { title: t.title, description: t.description, unit_label: t.unit_label, note_for_kids: null, ...(steps.length ? { subtasks: steps } : {}) };
  }
  return LOCALES.every((l) => out[l]) ? out : null;
}

/** Re-run the English / French / Spanish / Portuguese translation of chores (one, or all of them when no id). */
export async function retranslateChores(choreId?: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    let q = ctx.supabase
      .from("chores")
      .select("id, title, description, unit_label, note_for_kids, subtasks")
      .eq("household_id", ctx.household.id);
    if (choreId) q = q.eq("id", z.uuid().parse(choreId));
    const { data: rows, error } = await q.limit(200);
    if (error) throw error;
    let done = 0;
    for (let i = 0; i < rows.length; i += 5) {
      const results = await Promise.all(
        rows.slice(i, i + 5).map(async (r) => {
          const steps = parseSubtasks(r.subtasks);
          const t = await translateChoreText({
            title: r.title,
            description: r.description || null,
            unit_label: r.unit_label || null,
            note_for_kids: r.note_for_kids || null,
            ...(steps.length ? { subtasks: steps } : {}),
          });
          if (!t) return false;
          const mine = t[asLocale(ctx.household.locale)];
          const { error: upError } = await ctx.supabase
            .from("chores")
            .update({ ...(mine ?? {}), subtasks: (mine?.subtasks ?? steps) as unknown as { [k: string]: Json }[], translations: t as unknown as { [k: string]: Json } })
            .eq("household_id", ctx.household.id)
            .eq("id", r.id);
          if (upError) throw upError;
          return true;
        }),
      );
      done += results.filter(Boolean).length;
    }
    if (rows.length > 0 && done === 0) {
      throw new ActionError("invalid", parentT(ctx.locale)("b.err.translateUnavailable"));
    }
    revalidateChores();
    return { translated: done, total: rows.length };
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
      .insert({ ...rest, title: parentT(ctx.locale)("b.chores.copyTitle", { title: rest.title }).slice(0, 80), sort_order: rest.sort_order + 1 })
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
      throw new ActionError("invalid", parentT(ctx.locale)("b.err.choreHasHistory"));
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
      .in("key", parsed.map((p) => p.key));
    if (error) throw error;
    const byKey = new Map(templates.filter((t) => t.locale === ctx.household.locale).map((t) => [t.key, t]));
    const textOf = (key: string) => {
      const out: ChoreTranslations = {};
      for (const t of templates) {
        if (t.key !== key || !isLocale(t.locale)) continue;
        const steps = parseSubtasks(t.subtasks);
        out[t.locale] = { title: t.title, description: t.description, unit_label: t.unit_label, note_for_kids: null, ...(steps.length ? { subtasks: steps } : {}) };
      }
      return out as unknown as { [k: string]: Json };
    };
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
          category: t.category ?? "other",
          subtasks: t.subtasks,
          translations: textOf(t.key),
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
