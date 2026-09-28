import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Delete a household and everything in it (billing stopped first, avatar files removed). */
export async function purgeHousehold(admin: Admin, householdId: string): Promise<void> {
  const { data: sub } = await admin.from("subscriptions").select("stripe_subscription_id, status").eq("household_id", householdId).maybeSingle();
  if (sub?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(sub.status)) {
    const { stripe } = await import("@/lib/billing/stripe");
    await stripe().subscriptions.cancel(sub.stripe_subscription_id);
  }
  const { data: files } = await admin.storage.from("avatars").list(householdId);
  if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${householdId}/${f.name}`));
  const { error } = await admin.from("households").delete().eq("id", householdId);
  if (error) throw error;
}

/**
 * "Delete my account" (App Store 5.1.1(v), Google Play): the parent's sign-in goes away for good.
 * A home they're alone in is deleted with everything in it; a home shared with a co-parent stays
 * with that co-parent (who becomes its owner if needed). Push tokens go with the user (cascade).
 */
export async function deleteAccount(userId: string): Promise<{ deletedHouseholds: number }> {
  const admin = createAdminClient();
  const { data: memberships, error } = await admin.from("household_members").select("household_id, role").eq("user_id", userId);
  if (error) throw error;
  let deletedHouseholds = 0;
  for (const m of memberships ?? []) {
    const { data: others } = await admin
      .from("household_members")
      .select("user_id, role, created_at")
      .eq("household_id", m.household_id)
      .neq("user_id", userId)
      .order("created_at", { ascending: true });
    if (!others?.length) {
      await purgeHousehold(admin, m.household_id);
      deletedHouseholds++;
      continue;
    }
    await admin.from("household_members").delete().eq("household_id", m.household_id).eq("user_id", userId);
    if (m.role === "owner" && !others.some((o) => o.role === "owner")) {
      await admin.from("household_members").update({ role: "owner" }).eq("household_id", m.household_id).eq("user_id", others[0]!.user_id);
    }
  }
  const { error: delError } = await admin.auth.admin.deleteUser(userId);
  if (delError) throw delError;
  await admin.from("audit_log").insert({ actor: null, action: "account.deleted", details: { user_id: userId, deleted_households: deletedHouseholds } });
  return { deletedHouseholds };
}
