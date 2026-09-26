"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction, type ParentContext } from "@/lib/auth/session";
import { MAX_KIDS } from "@/lib/billing/plans";
import { needsPaymentForAnotherKid } from "@/lib/billing/access";
import { syncKidQuantity } from "@/lib/billing/stripe";

const KID_COLORS = ["#E08A1E", "#B8431F", "#6B7A2E", "#7A3B4A", "#2F6F8F", "#C9962B", "#8A5A9E", "#3C8D6E"];
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

async function assertKidRoom(ctx: ParentContext, adding: number) {
  const { count } = await ctx.supabase
    .from("kids")
    .select("id", { count: "exact", head: true })
    .eq("household_id", ctx.household.id)
    .is("archived_at", null);
  const current = count ?? 0;
  if (current + adding > MAX_KIDS) {
    throw new ActionError("invalid", `A household can have up to ${MAX_KIDS} kids.`);
  }
  // Each kid beyond the first needs the $5/month subscription (free during the trial).
  for (let i = 0; i < adding; i++) {
    if (needsPaymentForAnotherKid(ctx.subscription, new Date(), current + i)) {
      throw new ActionError(
        "limit",
        "Your first kid is free. Each extra kid is $5/month: start your subscription in Billing to add more.",
      );
    }
  }
  return current;
}

/** Stripe quantity follows the kid count; never let billing sync break the action. */
async function syncBilling(householdId: string) {
  try {
    await syncKidQuantity(householdId);
  } catch (e) {
    console.error("syncKidQuantity failed", e);
  }
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
    await syncBilling(ctx.household.id);
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
    await syncBilling(ctx.household.id);
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
    // Archiving is allowed even when read-only: it's how a lapsed household
    // gets back to the free single-kid plan.
    const ctx = archived ? await requireParentForArchive() : await requireWritableParent();
    if (!archived) await assertKidRoom(ctx, 1);
    // RLS blocks writes while read-only, so archiving uses the service role,
    // scoped to the household we just verified membership of.
    const db = archived ? (await import("@/lib/supabase/admin")).createAdminClient() : ctx.supabase;
    const { error } = await db
      .from("kids")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(kidId));
    if (error) throw error;
    await syncBilling(ctx.household.id);
    revalidatePath("/admin/kids");
  });
}

async function requireParentForArchive() {
  const { getParentContext } = await import("@/lib/auth/session");
  const ctx = await getParentContext();
  if (!ctx) throw new ActionError("forbidden", "Please log in again.");
  return ctx;
}
