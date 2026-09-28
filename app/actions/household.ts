"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { after } from "next/server";
import { ensureChoreLanguages } from "@/lib/choreLanguages";
import { isKnownCurrency } from "@/lib/money/currencies";
import { getParentContext, getUser, requireWritableParent, runAction, ActionError } from "@/lib/auth/session";
import { asLocale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";
import { zodErrorMessage } from "@/lib/i18n/parent/zodError";

const HouseholdInput = z.object({
  name: z.string().trim().min(1, "b.err.homeName").max(80),
  timezone: z.string().min(1).max(64),
  currency: z.string().regex(/^[A-Z]{3}$/).refine(isKnownCurrency),
  locale: z.enum(["en", "fr", "es", "pt"]),
});

/** Onboarding step 1: create the household (starts the 14-day trial) or update it. */
export async function saveHomeStep(input: z.input<typeof HouseholdInput>) {
  const result = await runAction(async () => {
    const locale = asLocale(input.locale);
    const parsed = HouseholdInput.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", zodErrorMessage(locale, parsed.error.issues));
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
    if (error) throw new ActionError("invalid", error.message.includes("timezone") ? parentT(locale)("b.err.validTimezone") : error.message);
    return data;
  });
  if (result.ok) redirect("/onboarding/kids");
  return result;
}

const Settings = z.object({
  name: z.string().trim().min(1).max(80),
  timezone: z.string().min(1).max(64),
  currency: z.string().regex(/^[A-Z]{3}$/).refine(isKnownCurrency),
  locale: z.enum(["en", "fr", "es", "pt"]),
  week_starts_on: z.coerce.number().int().min(0).max(6),
  admin_timeout_minutes: z.coerce.number().int().min(1).max(240),
  kid_idle_seconds: z.coerce.number().int().min(15).max(900),
  savings_match_percent: z.coerce.number().int().min(0).max(200),
  theme: z.enum(["fall", "plain"]),
  weekly_report_dow: z.coerce.number().int().min(0).max(6).optional(),
  weekly_report_hour: z.coerce.number().int().min(0).max(23).optional(),
});

export async function updateHouseholdSettings(input: z.input<typeof Settings>) {
  return runAction(async () => {
    const ctx = await requireWritableParent();
    const parsed = Settings.safeParse(input);
    if (!parsed.success) throw new ActionError("invalid", zodErrorMessage(ctx.locale, parsed.error.issues));
    const { error } = await ctx.supabase.from("households").update(parsed.data).eq("id", ctx.household.id);
    if (error) throw error;
    // New home language: the parent's copy of each chore switches to it (translating what's missing).
    if (parsed.data.locale && parsed.data.locale !== ctx.household.locale) {
      const householdId = ctx.household.id;
      after(() => ensureChoreLanguages(householdId, { rebase: true }).then(() => revalidatePath("/admin/chores")));
    }
    revalidatePath("/admin", "layout");
  });
}

/** Danger zone: owner types the household name to confirm. */
export async function deleteHousehold(confirmName: string) {
  const result = await runAction(async () => {
    const ctx = await getParentContext();
    const t = parentT(ctx?.locale ?? "en");
    if (!ctx?.isOwner) throw new ActionError("forbidden", t("b.err.ownerOnlyDelete"));
    if (confirmName.trim() !== ctx.household.name) throw new ActionError("invalid", t("b.err.nameMismatch"));
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { purgeHousehold } = await import("@/lib/account/delete");
    const admin = createAdminClient();
    await purgeHousehold(admin, ctx.household.id);
    await admin.from("audit_log").insert({ actor: ctx.user.id, action: "household.deleted", details: { name: ctx.household.name } });
  });
  if (result.ok) redirect("/onboarding/home");
  return result;
}
