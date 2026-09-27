/** Share invites: parents read only their household's rows; nobody writes through the API; signups mark "joined". Local stack only. */
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORD = `shr-${randomUUID()}`;
const users: string[] = [];

async function parent(label: string) {
  const email = `shr-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  users.push(u.user.id);
  const client: Client = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  const { data: householdId, error: hErr } = await client.rpc("create_household", {
    p_name: `Share ${label}`,
    p_timezone: "America/Toronto",
    p_currency: "CAD",
    p_locale: "en",
  });
  if (hErr) throw hErr;
  return { client, userId: u.user.id, householdId, email };
}

let a: Awaited<ReturnType<typeof parent>>;
let b: Awaited<ReturnType<typeof parent>>;
const friend = `shr-friend-${randomUUID().slice(0, 8)}@example.test`;

beforeAll(async () => {
  a = await parent("a");
  b = await parent("b");
  const { error } = await admin.from("share_invites").insert({ household_id: a.householdId, sender_user_id: a.userId, email: friend, locale: "fr" });
  if (error) throw error;
});
afterAll(async () => {
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

describe("share invites", () => {
  it("a parent reads their household's invitations; another household sees none", async () => {
    expect((await a.client.from("share_invites").select("email")).data).toEqual([{ email: friend }]);
    expect((await b.client.from("share_invites").select("email")).data).toEqual([]);
    const anon = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
    expect((await anon.from("share_invites").select("email")).data ?? []).toEqual([]);
  });

  it("parents can't insert, update or delete directly", async () => {
    expect((await a.client.from("share_invites").insert({ household_id: a.householdId, sender_user_id: a.userId, email: "x@example.test" })).error).not.toBeNull();
    await a.client.from("share_invites").update({ send_count: 99, joined_at: new Date().toISOString() }).eq("email", friend);
    await a.client.from("share_invites").delete().eq("email", friend);
    const { data } = await admin.from("share_invites").select("send_count, joined_at").eq("email", friend);
    expect(data).toEqual([{ send_count: 1, joined_at: null }]);
  });

  it("the account check is server-only", async () => {
    expect((await a.client.rpc("email_has_account", { p_email: b.email })).error).not.toBeNull();
    expect((await admin.rpc("email_has_account", { p_email: b.email.toUpperCase() })).data).toBe(true);
    expect((await admin.rpc("email_has_account", { p_email: friend })).data).toBe(false);
  });

  it("a new account with an invited email marks the invitation as joined", async () => {
    const { data: u, error } = await admin.auth.admin.createUser({ email: friend.toUpperCase(), password: PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(u.user.id);
    const { data } = await a.client.from("share_invites").select("joined_user_id, joined_at").eq("email", friend).single();
    expect(data?.joined_user_id).toBe(u.user.id);
    expect(data?.joined_at).not.toBeNull();
  });
});
