import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHouseholdAccess, type HouseholdAccess } from "@/lib/billing/access";
import type { PlanId } from "@/lib/billing/plans";
import type { Tables } from "@/lib/supabase/database.types";
import { asLocale, type Locale } from "@/lib/i18n";

export type Household = Tables<"households">;
export type Subscription = Tables<"subscriptions">;
export type Membership = Pick<Tables<"household_members">, "household_id" | "user_id" | "role" | "display_name" | "created_at">;

export interface ParentContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email: string };
  household: Household;
  membership: Membership;
  subscription: Subscription | null;
  plan: PlanId;
  activeKids: number;
  access: HouseholdAccess;
  isOwner: boolean;
  locale: Locale;
}

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

/** The signed-in parent and their household, or null. One household per parent in v1. */
export const getParentContext = cache(async (): Promise<ParentContext | null> => {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, user_id, role, display_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const [{ data: household }, { data: subscription }, { count: activeKids }] = await Promise.all([
    supabase.from("households").select("*").eq("id", membership.household_id).single(),
    supabase.from("subscriptions").select("*").eq("household_id", membership.household_id).maybeSingle(),
    supabase
      .from("kids")
      .select("id", { count: "exact", head: true })
      .eq("household_id", membership.household_id)
      .is("archived_at", null),
  ]);
  if (!household) return null;

  return {
    supabase,
    user: { id: user.id, email: user.email ?? "" },
    household,
    membership,
    subscription,
    plan: (subscription?.plan ?? "free") as PlanId,
    activeKids: activeKids ?? 0,
    access: getHouseholdAccess(subscription, new Date(), activeKids ?? 0),
    isOwner: membership.role === "owner",
    locale: asLocale(household.locale),
  };
});

/** For admin pages: signed in, with a household. */
export async function requireParent(): Promise<ParentContext> {
  const { user } = await getUser();
  if (!user) redirect("/login");
  const ctx = await getParentContext();
  if (!ctx) redirect("/onboarding/home");
  return ctx;
}

export class ActionError extends Error {
  constructor(
    public code: "read_only" | "forbidden" | "limit" | "invalid" | "not_found",
    message: string,
  ) {
    super(message);
  }
}

/** For mutations: re-checks membership and write access on the server. */
export async function requireWritableParent(): Promise<ParentContext> {
  const ctx = await getParentContext();
  if (!ctx) throw new ActionError("forbidden", "Please log in again.");
  if (ctx.access !== "full") throw new ActionError(
      "read_only",
      "Your board is read-only: extra kids need a subscription ($5/month each). Subscribe or archive kids to keep going.",
    );
  return ctx;
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; code: string; message: string };

/** Wrap a server action body so errors become friendly results, never raw throws. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, code: e.code, message: e.message };
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    console.error(e);
    return { ok: false, code: "error", message: "Something went wrong. Please try again." };
  }
}
