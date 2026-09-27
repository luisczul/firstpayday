"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireWritableParent, runAction } from "@/lib/auth/session";
import { parentT, type ParentKey } from "@/lib/i18n/parent";

const RATE = "a.err.taxRate" satisfies ParentKey;

const FamilyTax = z.object({
  enabled: z.boolean(),
  percent: z.coerce.number().int().min(1, RATE).max(50, RATE),
});

/** Optional family tax (Settings and the last onboarding step). */
export async function setFamilyTax(input: z.input<typeof FamilyTax>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = FamilyTax.safeParse(input);
    if (!parsed.success) {
      const t = parentT(ctx.locale);
      const m = parsed.error.issues[0]?.message;
      throw new ActionError("invalid", m?.startsWith("a.") ? t(m as ParentKey) : t("a.common.checkForm"));
    }
    const { error } = await ctx.supabase
      .from("households")
      .update({ tax_enabled: parsed.data.enabled, tax_percent: parsed.data.percent })
      .eq("id", ctx.household.id);
    if (error) throw error;
    revalidatePath("/admin", "layout");
  });
}
