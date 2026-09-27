/** Support messages: a parent sends and reads only their own; nobody edits or impersonates. Local stack only. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";
import type { Database } from "../../lib/supabase/database.types";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url?.includes("127.0.0.1") && !url?.includes("localhost")) throw new Error("Run against the LOCAL Supabase only.");
type Client = SupabaseClient<Database>;
const admin: Client = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PASSWORD = `sup-${randomUUID()}`;
const users: string[] = [];

async function parent(label: string) {
  const email = `sup-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  users.push(u.user.id);
  const client: Client = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  const { data: householdId, error: hErr } = await client.rpc("create_household", {
    p_name: `Sup ${label}`,
    p_timezone: "America/Toronto",
    p_currency: "CAD",
    p_locale: "en",
  });
  if (hErr) throw hErr;
  return { client, userId: u.user.id, householdId };
}

let a: Awaited<ReturnType<typeof parent>>;
let b: Awaited<ReturnType<typeof parent>>;

beforeAll(async () => {
  a = await parent("a");
  b = await parent("b");
});
afterAll(async () => {
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

describe("support messages", () => {
  it("a parent sends for their own home and reads it back", async () => {
    const { error } = await a.client.from("support_messages").insert({ household_id: a.householdId, user_id: a.userId, kind: "bug", message: "Button broken" });
    expect(error).toBeNull();
    const { data } = await a.client.from("support_messages").select("message");
    expect(data?.map((r) => r.message)).toEqual(["Button broken"]);
  });

  it("can't read other parents' messages, impersonate, use another home, or edit", async () => {
    expect((await b.client.from("support_messages").select("id")).data).toEqual([]);
    expect((await b.client.from("support_messages").insert({ household_id: b.householdId, user_id: a.userId, kind: "bug", message: "x" })).error).not.toBeNull();
    expect((await b.client.from("support_messages").insert({ household_id: a.householdId, user_id: b.userId, kind: "bug", message: "x" })).error).not.toBeNull();
    expect((await a.client.from("support_messages").insert({ household_id: a.householdId, user_id: a.userId, kind: "bug", message: "x", status: "done" })).error).not.toBeNull();
    await a.client.from("support_messages").update({ status: "done" }).eq("user_id", a.userId);
    const { data } = await admin.from("support_messages").select("status").eq("user_id", a.userId);
    expect(data?.every((r) => r.status === "new")).toBe(true);
  });
});
