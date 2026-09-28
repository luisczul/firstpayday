import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUser, body, noContent } from "@/lib/app/api";

/** Forget this phone's push token and end the session (the refresh token stops working). */
export async function POST(req: Request) {
  const user = await appUser(req);
  if (user instanceof NextResponse) return user;
  const token = z.string().min(1).max(4096).safeParse((await body(req))?.pushToken);
  if (token.success) await createAdminClient().from("push_tokens").delete().eq("user_id", user.id).eq("token", token.data);
  await createAdminClient().auth.admin.signOut(user.token, "local");
  return noContent();
}
