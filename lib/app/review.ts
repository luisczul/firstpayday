import "server-only";
import type { ParentContext } from "@/lib/auth/session";
import { friendlyReviewError, reviewErrorKind } from "@/lib/approvals/errors";
import { fail } from "@/lib/app/api";

/** A database error from a review, as the app API's error (an already-handled chore is a 409). */
export function reviewFailure(ctx: ParentContext, dbMessage: string) {
  const message = friendlyReviewError(ctx, dbMessage).message;
  switch (reviewErrorKind(dbMessage)) {
    case "read_only":
      return fail("forbidden", message, 403);
    case "not_found":
      return fail("not_found", message, 404);
    case "already_reviewed":
      return fail("conflict", message, 409);
    default:
      return fail("invalid", message, 400);
  }
}
