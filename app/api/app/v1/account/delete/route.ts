import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/account/delete";
import { asLocale } from "@/lib/i18n";
import { parentT } from "@/lib/i18n/parent";
import { appLocale, appUser, body, fail, noContent } from "@/lib/app/api";
import { trackActivity } from "@/lib/slack/activity";

/** "Delete my account" from the app: the parent retypes their email; the sign-in is deleted for good. */
export async function POST(req: Request) {
  const user = await appUser(req);
  if (user instanceof NextResponse) return user;
  const confirm = (await body(req))?.confirmEmail;
  if (typeof confirm !== "string" || confirm.trim().toLowerCase() !== user.email.toLowerCase()) {
    return fail("invalid", parentT(asLocale(appLocale(req)))("b.err.emailMismatch"), 400);
  }
  await deleteAccount(user.id);
  trackActivity({ kind: "account_deleted", email: user.email });
  return noContent();
}
