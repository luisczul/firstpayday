"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction } from "@/lib/auth/session";
import { zonedDateTimeToInstant } from "@/lib/schedule/tz";
import { parentT } from "@/lib/i18n/parent";
import { zodErrorMessage } from "@/lib/i18n/parent/zodError";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const PromotionInput = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, "b.err.promoName").max(60),
    startDate: z.string().regex(DATE, "b.err.startDate"),
    startTime: z.string().regex(TIME, "b.err.startTime"),
    endDate: z.string().regex(DATE, "b.err.endDate"),
    endTime: z.string().regex(TIME, "b.err.endTime"),
    bonusKind: z.enum(["flat", "percent"]),
    bonusValue: z.number().int(),
  })
  .superRefine((p, ctx) => {
    if (p.bonusKind === "flat" && (p.bonusValue < 1 || p.bonusValue > 10_000)) {
      ctx.addIssue({ code: "custom", message: "b.err.bonusRange" });
    }
    if (p.bonusKind === "percent" && (p.bonusValue < 1 || p.bonusValue > 200)) {
      ctx.addIssue({ code: "custom", message: "b.err.percentRange" });
    }
  });

/** Create or edit a promotion; dates and times are in the household timezone. */
export async function savePromotion(input: z.input<typeof PromotionInput>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = PromotionInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", zodErrorMessage(ctx.locale, parsed.error.issues));
    const t = parentT(ctx.locale);
    const p = parsed.data;
    const tz = ctx.household.timezone;
    const startsAt = zonedDateTimeToInstant(p.startDate, p.startTime, tz);
    const endsAt = zonedDateTimeToInstant(p.endDate, p.endTime, tz);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new ActionError("invalid", t("b.err.checkDates"));
    if (endsAt <= startsAt) throw new ActionError("invalid", t("b.err.endAfterStart"));
    const row = {
      name: p.name,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      bonus_kind: p.bonusKind,
      bonus_value: p.bonusValue,
    };
    const { error } = p.id
      ? await ctx.supabase.from("promotions").update(row).eq("id", p.id).eq("household_id", ctx.household.id)
      : await ctx.supabase.from("promotions").insert({ ...row, household_id: ctx.household.id, created_by: ctx.user.id });
    if (error) throw error;
    revalidatePath("/admin/settings/promotions");
    revalidatePath("/admin/approvals");
  });
}

/** End a running promotion now (chores already submitted keep their bonus). */
export async function endPromotion(id: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const { data: promo } = await ctx.supabase
      .from("promotions")
      .select("starts_at, ends_at")
      .eq("id", z.uuid().parse(id))
      .eq("household_id", ctx.household.id)
      .maybeSingle();
    if (!promo) throw new ActionError("not_found", parentT(ctx.locale)("b.err.promoGone"));
    const now = new Date();
    if (new Date(promo.ends_at) <= now) return;
    if (new Date(promo.starts_at) > now) {
      const { error } = await ctx.supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await ctx.supabase.from("promotions").update({ ends_at: now.toISOString() }).eq("id", id);
      if (error) throw error;
    }
    revalidatePath("/admin/settings/promotions");
    revalidatePath("/admin/approvals");
  });
}

/** Delete a promotion that hasn't started yet. */
export async function deletePromotion(id: string) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const { data, error } = await ctx.supabase
      .from("promotions")
      .delete()
      .eq("id", z.uuid().parse(id))
      .eq("household_id", ctx.household.id)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new ActionError("invalid", parentT(ctx.locale)("b.err.promoStarted"));
    revalidatePath("/admin/settings/promotions");
  });
}
