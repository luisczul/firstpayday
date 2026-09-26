import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_MODE_COOKIE } from "@/lib/auth/adminMode";
import { createClient } from "@/lib/supabase/server";

/** Sign the parent out on this tablet and return to Kids Mode. */
async function exit(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ADMIN_MODE_COOKIE);
  return NextResponse.redirect(new URL("/kids", request.url), { status: 303 });
}

export const GET = exit;
export const POST = exit;
