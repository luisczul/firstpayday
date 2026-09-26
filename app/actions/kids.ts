"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction, type ParentContext } from "@/lib/auth/session";
import { PLAN_LIMITS, withinLimit } from "@/lib/billing/plans";

const KID_COLORS = ["#E08A1E", "#B8431F", "#6B7A2E", "#7A3B4A", "#2F6F8F", "#C9962B", "#8A5A9E", "#3C8D6E"];
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

async function assertKidRoom(ctx: ParentContext, adding: number) {
  const { count } = await ctx.supabase
    .from("kids")
    .select("id", { count: "exact", head: true })
    .eq("household_id", ctx.household.id)
    .is("archived_at", null);
  if (!withinLimit(ctx.plan, "kids", (count ?? 0) + adding - 1)) {
    throw new ActionError(
      "limit",
      `Your plan includes up to ${PLAN_LIMITS[ctx.plan].kids} kids. Upgrade to Family Plus to add more.`,
    );
  }
  return count ?? 0;
}

/** Onboarding: add several kids at once. Returns their ids (for photo upload). */
export async function addKids(names: string[]) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (clean.length === 0) throw new ActionError("invalid", "Add at least one kid.");
    if (clean.some((n) => n.length > 40)) throw new ActionError("invalid", "Names can be up to 40 characters.");
    const existing = await assertKidRoom(ctx, clean.length);
    const { data, error } = await ctx.supabase
      .from("kids")
      .insert(
        clean.map((name, i) => ({
          household_id: ctx.household.id,
          name,
          color: KID_COLORS[(existing + i) % KID_COLORS.length]!,
          sort_order: existing + i,
        })),
      )
      .select("id, name");
    if (error) throw error;
    revalidatePath("/admin/kids");
    return { kids: data, householdId: ctx.household.id };
  });
}

const KidInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(40),
  color,
  sort_order: z.coerce.number().int().min(0).max(1000).optional(),
});

export async function createKid(input: z.input<typeof KidInput>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = KidInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", parsed.error.issues[0]?.message ?? "Check the form.");
    const existing = await assertKidRoom(ctx, 1);
    const { data, error } = await ctx.supabase
      .from("kids")
      .insert({ household_id: ctx.household.id, sort_order: existing, ...parsed.data })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/admin/kids");
    return { id: data.id, householdId: ctx.household.id };
  });
}

export async function updateKid(kidId: string, input: z.input<typeof KidInput>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = KidInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", parsed.error.issues[0]?.message ?? "Check the form.");
    const { error } = await ctx.supabase
      .from("kids")
      .update(parsed.data)
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(kidId));
    if (error) throw error;
    revalidatePath("/admin/kids");
    revalidatePath(`/admin/kids/${kidId}`);
  });
}

/** After the browser uploaded avatars/{household}/{kid}.webp. */
export async function setKidAvatar(kidId: string, hasPhoto: boolean) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const id = z.uuid().parse(kidId);
    const path = hasPhoto ? `${ctx.household.id}/${id}.webp` : null;
    if (!hasPhoto) await ctx.supabase.storage.from("avatars").remove([`${ctx.household.id}/${id}.webp`]);
    const { error } = await ctx.supabase
      .from("kids")
      .update({ avatar_path: path })
      .eq("household_id", ctx.household.id)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/kids");
  });
}

export async function setKidArchived(kidId: string, archived: boolean) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    if (!archived) await assertKidRoom(ctx, 1);
    const { error } = await ctx.supabase
      .from("kids")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(kidId));
    if (error) throw error;
    revalidatePath("/admin/kids");
  });
}
