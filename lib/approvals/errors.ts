import "server-only";
import { ActionError, type ParentContext } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { formatMoney } from "@/lib/money/format";

export const MAX_TIP_CENTS = 10_000;

export function tipTooBig(ctx: ParentContext): ActionError {
  const max = formatMoney(MAX_TIP_CENTS, ctx.household.currency, ctx.locale);
  return new ActionError("invalid", parentT(ctx.locale)("a.err.tipMax", { max }));
}

export type ReviewErrorKind = "read_only" | "tip" | "quantity" | "not_found" | "already_reviewed";

/** What went wrong, from the database's error message when approving / sending back. */
export function reviewErrorKind(message: string): ReviewErrorKind {
  if (message.includes("read-only")) return "read_only";
  if (message.includes("bonus")) return "tip";
  if (message.includes("quantity")) return "quantity";
  if (message.includes("not found")) return "not_found";
  return "already_reviewed";
}

/** A database error from approving / sending back, as a message the parent understands. */
export function friendlyReviewError(ctx: ParentContext, message: string): ActionError {
  const t = parentT(ctx.locale);
  switch (reviewErrorKind(message)) {
    case "read_only":
      return new ActionError("read_only", t("a.err.readOnlyApprove"));
    case "tip":
      return tipTooBig(ctx);
    case "quantity":
      return new ActionError("invalid", t("a.err.quantity"));
    case "not_found":
      return new ActionError("not_found", t("a.err.submissionGone"));
    default:
      return new ActionError("invalid", t("a.err.alreadyReviewed"));
  }
}
