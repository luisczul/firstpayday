"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { after } from "next/server";
import { ensureChoreLanguages } from "@/lib/choreLanguages";
import { PRESET_PREFIX, isPresetId } from "@/lib/avatarPresets";
import { ActionError, requireWritableParent, runAction, type ParentContext } from "@/lib/auth/session";
import { MAX_KIDS } from "@/lib/billing/plans";
import { needsPaymentForAnotherKid } from "@/lib/billing/access";
import { syncKidQuantity } from "@/lib/billing/stripe";
import { parentT, type ParentKey } from "@/lib/i18n/parent";
import { trackActivity } from "@/lib/slack/activity";

/** Zod messages are parent-dictionary keys; anything else (zod defaults) becomes "Check the form." */
function issueMessage(ctx: ParentContext, message: string | undefined): string {
  const t = parentT(ctx.locale);
  return message?.startsWith("a.") ? t(message as ParentKey) : t("a.common.checkForm");
}

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
    throw new ActionError("invalid", parentT(ctx.locale)("a.err.maxKids", { max: MAX_KIDS }));
  }
  // Each kid beyond the first needs the $5/month subscription (free during the trial).
  for (let i = 0; i < adding; i++) {
    if (needsPaymentForAnotherKid(ctx.subscription, new Date(), current + i)) {
      throw new ActionError("limit", parentT(ctx.locale)("a.err.kidLimit"));
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
    const t = parentT(ctx.locale);
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (clean.length === 0) throw new ActionError("invalid", t("a.onb.kids.atLeastOne"));
    if (clean.some((n) => n.length > 40)) throw new ActionError("invalid", t("a.err.nameLength"));
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
    trackActivity({ kind: "kids_added", householdId: ctx.household.id, count: clean.length, detail: clean.join(", ") });
    revalidatePath("/admin/kids");
    return { kids: data, householdId: ctx.household.id };
  });
}

const KidInput = z.object({
  name: z.string().trim().min(1, "a.err.nameRequired" satisfies ParentKey).max(40, "a.err.nameLength" satisfies ParentKey),
  color,
  sort_order: z.coerce.number().int().min(0).max(1000).optional(),
  /** null = same as the household. */
  locale: z.enum(["en", "fr", "es", "pt"]).nullable().optional(),
});

export async function createKid(input: z.input<typeof KidInput>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = KidInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", issueMessage(ctx, parsed.error.issues[0]?.message));
    const existing = await assertKidRoom(ctx, 1);
    const { data, error } = await ctx.supabase
      .from("kids")
      .insert({ household_id: ctx.household.id, sort_order: existing, ...parsed.data })
      .select("id")
      .single();
    if (error) throw error;
    await syncBilling(ctx.household.id);
    trackActivity({ kind: "kids_added", householdId: ctx.household.id, count: 1, detail: parsed.data.name });
    revalidatePath("/admin/kids");
    return { id: data.id, householdId: ctx.household.id };
  });
}

export async function updateKid(kidId: string, input: z.input<typeof KidInput>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = KidInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", issueMessage(ctx, parsed.error.issues[0]?.message));
    const { error } = await ctx.supabase
      .from("kids")
      .update(parsed.data)
      .eq("household_id", ctx.household.id)
      .eq("id", z.uuid().parse(kidId));
    if (error) throw error;
    // A kid switched to another language: translate every chore they can't read yet, in the background.
    if (parsed.data.locale && parsed.data.locale !== ctx.household.locale) {
      const householdId = ctx.household.id;
      after(() => ensureChoreLanguages(householdId).then(() => revalidatePath("/admin/chores")));
    }
    revalidatePath("/admin/kids");
    revalidatePath(`/admin/kids/${kidId}`);
  });
}

/**
 * After the browser uploaded avatars/{household}/{kid}.webp (true), removed it (false),
 * or picked a cartoon avatar (its preset id, stored as "preset:<id>").
 */
export async function setKidAvatar(kidId: string, avatar: boolean | string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const id = z.uuid().parse(kidId);
    const preset = typeof avatar === "string" ? z.string().refine(isPresetId).parse(avatar) : null;
    const path = preset ? `${PRESET_PREFIX}${preset}` : avatar ? `${ctx.household.id}/${id}.webp` : null;
    if (avatar !== true) await ctx.supabase.storage.from("avatars").remove([`${ctx.household.id}/${id}.webp`]);
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
