"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ActionError, getParentContext, runAction } from "@/lib/auth/session";
import { deleteAccount } from "@/lib/account/delete";
import { ADMIN_MODE_COOKIE } from "@/lib/auth/adminMode";
import { parentT } from "@/lib/i18n/parent";

/** "Delete my account": the parent types their email to confirm. */
export async function deleteMyAccount(confirmEmail: string) {
  const result = await runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw new ActionError("forbidden", "Please log in again.");
    if (confirmEmail.trim().toLowerCase() !== ctx.user.email.toLowerCase()) {
      throw new ActionError("invalid", parentT(ctx.locale)("b.err.emailMismatch"));
    }
    await deleteAccount(ctx.user.id);
    await ctx.supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    (await cookies()).delete(ADMIN_MODE_COOKIE);
  });
  if (result.ok) redirect("/");
  return result;
}
