import { z } from "zod";
import { appMessage, body, fail, ok, sessionJson, statelessClient } from "@/lib/app/api";

export async function POST(req: Request) {
  const parsed = z.object({ refreshToken: z.string().min(1).max(4096) }).safeParse(await body(req));
  if (!parsed.success) return fail("unauthorized", appMessage(req, "unauthorized"), 401);
  const { data, error } = await statelessClient().auth.refreshSession({ refresh_token: parsed.data.refreshToken });
  if (error || !data.session) return fail("unauthorized", appMessage(req, "unauthorized"), 401);
  return ok(sessionJson(data.session));
}
