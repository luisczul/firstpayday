"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction } from "@/lib/auth/session";
import { checkPayout } from "@/lib/money/ledger";

async function balanceOf(ctx: Awaited<ReturnType<typeof requireWritableParent>>, kidId: string) {
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
    const p = Payout.parse(input);
    const check = checkPayout(p.amountCents, await balanceOf(ctx, p.kidId), p.allowNegative);
    if (!check.ok) {
      throw new ActionError(
        "invalid",
        check.reason === "exceeds_balance"
          ? "That's more than the balance. Tick “Allow negative” to pay out anyway."
          : "Enter an amount above zero.",
      );
    }
    const { error } = await ctx.supabase.from("ledger_entries").insert({
      household_id: ctx.household.id,
      kid_id: p.kidId,
      kind: "payout",
      amount_cents: -check.amountCents,
      method: p.method,
      note: p.note || null,
      created_by: ctx.user.id,
    });
    if (error) throw error;
    revalidatePath("/admin/payouts");
    revalidatePath("/admin/kids", "layout");
  });
}

const Adjustment = z.object({
  kidId: z.uuid(),
  amountCents: z.number().int().refine((n) => n !== 0, "Enter an amount."),
  note: z.string().trim().min(1, "Add a note so everyone knows why.").max(200),
});

export async function recordAdjustment(input: z.input<typeof Adjustment>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = Adjustment.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", parsed.error.issues[0]?.message ?? "Check the form.");
    const { error } = await ctx.supabase.from("ledger_entries").insert({
      household_id: ctx.household.id,
      kid_id: parsed.data.kidId,
      kind: "adjustment",
      amount_cents: parsed.data.amountCents,
      note: parsed.data.note,
      created_by: ctx.user.id,
    });
    if (error) throw error;
    revalidatePath("/admin/kids", "layout");
    revalidatePath("/admin/payouts");
  });
}
