"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";

async function audit(actor: string, action: string, householdId: string, details: Record<string, unknown>) {
  await createAdminClient().from("audit_log").insert({ actor, action, household_id: householdId, details: details as never });
}

export async function setComp(householdId: string, comp: boolean) {
  const me = await requirePlatformAdmin();
  const id = z.uuid().parse(householdId);
  const admin = createAdminClient();
  const { data: before } = await admin.from("subscriptions").select("plan, status").eq("household_id", id).single();
  const { error } = await admin
    .from("subscriptions")
    .update(comp ? { plan: "comp", status: "active", updated_at: new Date().toISOString() } : { plan: "trial", status: "trialing", trial_ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), updated_at: new Date().toISOString() })
    .eq("household_id", id);
  if (error) throw error;
  await audit(me.userId, comp ? "plan.set_comp" : "plan.remove_comp", id, { before });
  revalidatePath("/platform");
}

export async function extendTrial(householdId: string, days: 7 | 14) {
  const me = await requirePlatformAdmin();
  const id = z.uuid().parse(householdId);
  const n = z.union([z.literal(7), z.literal(14)]).parse(days);
  const admin = createAdminClient();
  const { data: sub } = await admin.from("subscriptions").select("*").eq("household_id", id).single();
  if (!sub || sub.stripe_subscription_id) throw new Error("Only unpaid trials can be extended here.");
  const base = sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date() ? new Date(sub.trial_ends_at) : new Date();
  const ends = new Date(base.getTime() + n * 86_400_000).toISOString();
  const { error } = await admin
    .from("subscriptions")
    .update({ plan: "trial", status: "trialing", trial_ends_at: ends, updated_at: new Date().toISOString() })
    .eq("household_id", id);
  if (error) throw error;
  await audit(me.userId, "trial.extend", id, { days: n, trial_ends_at: ends, before: sub.trial_ends_at });
  revalidatePath("/platform");
}
