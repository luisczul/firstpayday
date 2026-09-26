"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getParentContext, getUser, requireWritableParent, runAction, ActionError } from "@/lib/auth/session";

const HouseholdInput = z.object({
  name: z.string().trim().min(1, "Give your home a name.").max(80),
  timezone: z.string().min(1).max(64),
  currency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.enum(["en", "fr"]),
});

/** Onboarding step 1: create the household (starts the 14-day trial) or update it. */
export async function saveHomeStep(input: z.input<typeof HouseholdInput>) {
  const result = await runAction(async () => {
    const parsed = HouseholdInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", parsed.error.issues[0]?.message ?? "Check the form.");
    const { supabase, user } = await getUser();
    if (!user) throw new ActionError("forbidden", "Please log in again.");

    const existing = await getParentContext();
    if (existing) {
      const { error } = await supabase.from("households").update(parsed.data).eq("id", existing.household.id);
      if (error) throw error;
      return existing.household.id;
    }
    const { data, error } = await supabase.rpc("create_household", {
      p_name: parsed.data.name,
      p_timezone: parsed.data.timezone,
      p_currency: parsed.data.currency,
      p_locale: parsed.data.locale,
    });
    if (error) throw new ActionError("invalid", error.message.includes("timezone") ? "Pick a valid timezone." : error.message);
    return data;
  });
  if (result.ok) redirect("/onboarding/kids");
  return result;
}

const Settings = z.object({
  name: z.string().trim().min(1).max(80),
  timezone: z.string().min(1).max(64),
  currency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.enum(["en", "fr"]),
  week_starts_on: z.coerce.number().int().min(0).max(6),
  admin_timeout_minutes: z.coerce.number().int().min(1).max(240),
  kid_idle_seconds: z.coerce.number().int().min(15).max(900),
  savings_match_percent: z.coerce.number().int().min(0).max(200),
  theme: z.enum(["fall", "plain"]),
});

export async function updateHouseholdSettings(input: z.input<typeof Settings>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = Settings.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", parsed.error.issues[0]?.message ?? "Check the form.");
    const { PLAN_LIMITS } = await import("@/lib/billing/plans");
    if (parsed.data.savings_match_percent > 0 && !PLAN_LIMITS[ctx.plan].savingsMatch) {
      throw new ActionError("limit", "Savings match is part of Family Plus. Upgrade to turn it on.");
    }
    if (parsed.data.theme !== "fall" && !PLAN_LIMITS[ctx.plan].customThemes) {
      throw new ActionError("limit", "Custom themes are part of Family Plus.");
    }
    const { error } = await ctx.supabase.from("households").update(parsed.data).eq("id", ctx.household.id);
    if (error) throw error;
    revalidatePath("/admin", "layout");
  });
}

/** Danger zone: owner types the household name to confirm. */
export async function deleteHousehold(confirmName: string) {
  const result = await runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx?.isOwner) throw new ActionError("forbidden", "Only the owner can delete the household.");
    if (confirmName.trim() !== ctx.household.name) throw new ActionError("invalid", "The name doesn't match.");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: files } = await admin.storage.from("avatars").list(ctx.household.id);
    if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${ctx.household.id}/${f.name}`));
    const { error } = await ctx.supabase.from("households").delete().eq("id", ctx.household.id);
    if (error) throw error;
    await admin.from("audit_log").insert({ actor: ctx.user.id, action: "household.deleted", details: { name: ctx.household.name } });
  });
  if (result.ok) redirect("/onboarding/home");
  return result;
}
