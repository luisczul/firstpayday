"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction } from "@/lib/auth/session";
import { checkPayout } from "@/lib/money/ledger";
import { familyPotCents } from "@/lib/familyPot";
import { translateReward } from "@/lib/choreLanguages";
import { parentT, type ParentKey } from "@/lib/i18n/parent";

type Ctx = Awaited<ReturnType<typeof requireWritableParent>>;

/** Zod messages are parent-dictionary keys; anything else (zod defaults) becomes "Check the form." */
function issueMessage(ctx: Ctx, message: string | undefined): string {
  const t = parentT(ctx.locale);
  return message?.startsWith("a.") ? t(message as ParentKey) : t("a.common.checkForm");
}

async function balanceOf(ctx: Ctx, kidId: string) {
  const { data } = await ctx.supabase
    .from("kid_balances")
    .select("balance_cents")
    .eq("household_id", ctx.household.id)
    .eq("kid_id", kidId)
    .maybeSingle();
  return data?.balance_cents ?? 0;
}

const Payout = z.object({
  kidId: z.uuid(),
  amountCents: z.number().int(),
  method: z.enum(["cash", "bank", "savings", "other"]),
  note: z.string().trim().max(200).optional(),
  allowNegative: z.boolean(),
});

export async function recordPayout(input: z.input<typeof Payout>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const t = parentT(ctx.locale);
    const p = Payout.parse(input);
    const check = checkPayout(p.amountCents, await balanceOf(ctx, p.kidId), p.allowNegative);
    if (!check.ok) {
      throw new ActionError(
        "invalid",
        check.reason === "exceeds_balance" ? t("a.err.exceedsBalance") : t("a.common.amountAboveZero"),
      );
    }
    // record_payout() withholds the family tax (when on) and writes both rows.
    const { data, error } = await ctx.supabase.rpc("record_payout", {
      p_kid_id: p.kidId,
      p_gross_cents: check.amountCents,
      p_method: p.method,
      p_note: p.note || undefined,
      p_allow_negative: p.allowNegative,
    });
    if (error) {
      if (error.message.includes("exceeds balance")) {
        throw new ActionError("invalid", t("a.err.exceedsBalance"));
      }
      throw error;
    }
    const r = data as { gross_cents: number; tax_cents: number; net_cents: number };
    revalidatePath("/admin/payouts");
    revalidatePath("/admin/kids", "layout");
    return { grossCents: r.gross_cents, taxCents: r.tax_cents, netCents: r.net_cents };
  });
}

const FamilyTreat = z.object({
  amountCents: z.number().int().positive("a.common.amountAboveZero" satisfies ParentKey).max(10_000_000),
  note: z.string().trim().min(1, "a.err.treatNote" satisfies ParentKey).max(120),
});

/** Spend (part of) the family tax pot on something everyone shares. */
export async function recordFamilyTreat(input: z.input<typeof FamilyTreat>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = FamilyTreat.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", issueMessage(ctx, parsed.error.issues[0]?.message));
    const pot = await familyPotCents(ctx.supabase, ctx.household.id);
    if (parsed.data.amountCents > pot) throw new ActionError("invalid", parentT(ctx.locale)("a.err.potTooSmall"));
    const { error } = await ctx.supabase.from("family_pot_spends").insert({
      household_id: ctx.household.id,
      amount_cents: parsed.data.amountCents,
      note: parsed.data.note,
      created_by: ctx.user.id,
    });
    if (error) throw error;
    revalidatePath("/admin/payouts");
  });
}

const Adjustment = z.object({
  kidId: z.uuid(),
  amountCents: z.number().int().refine((n) => n !== 0, "a.common.enterAmount" satisfies ParentKey),
  icon: z.string().trim().max(16).optional(),
  title: z.string().trim().min(1, "a.err.rewardName" satisfies ParentKey).max(80),
  note: z.string().trim().max(200).optional(),
});

/**
 * Add to (or take from) a kid's balance for something that isn't a chore: an icon, a short name
 * ("Helped me with the groceries") and, optionally, what it was. Kids see it in their money list.
 */
export async function recordAdjustment(input: z.input<typeof Adjustment>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = Adjustment.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", issueMessage(ctx, parsed.error.issues[0]?.message));
    const { data, error } = await ctx.supabase
      .from("ledger_entries")
      .insert({
        household_id: ctx.household.id,
        kid_id: parsed.data.kidId,
        kind: "adjustment",
        amount_cents: parsed.data.amountCents,
        icon: parsed.data.icon || null,
        title: parsed.data.title,
        note: parsed.data.note || null,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    const hid = ctx.household.id;
    after(() => translateReward(hid, data.id).catch((e) => console.error("translateReward", e)));
    revalidatePath("/admin/kids", "layout");
    revalidatePath("/admin/payouts");
  });
}
