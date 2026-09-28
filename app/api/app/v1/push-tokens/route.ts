import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUser, body, fail, noContent } from "@/lib/app/api";

const Token = z.string().trim().min(8).max(4096);

/** Remember this phone's push token for the signed-in parent (idempotent; a token moves to its latest owner). */
export async function POST(req: Request) {
  const user = await appUser(req);
  if (user instanceof NextResponse) return user;
  const parsed = z
    .object({ token: Token, platform: z.enum(["ios", "android"]), locale: z.enum(["en", "fr", "es", "pt"]).optional() })
    .safeParse(await body(req));
  if (!parsed.success) return fail("invalid", "Invalid push token.", 400);
  const { error } = await createAdminClient()
    .from("push_tokens")
    .upsert(
      { user_id: user.id, token: parsed.data.token, platform: parsed.data.platform, locale: parsed.data.locale ?? null, last_seen_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  if (error) throw error;
  return noContent();
}

export async function DELETE(req: Request) {
  const user = await appUser(req);
  if (user instanceof NextResponse) return user;
  const token = Token.safeParse((await body(req))?.token);
  if (!token.success) return fail("invalid", "Invalid push token.", 400);
  await createAdminClient().from("push_tokens").delete().eq("user_id", user.id).eq("token", token.data);
  return noContent();
}
