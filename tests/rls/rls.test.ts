/**
 * Row-level security proofs (SPEC §15): household A can never read or write
 * household B's data, ledger rows are immutable, and privileged functions
 * aren't reachable from the browser. Runs against the local stack:
 *
 *   pnpm db:start && pnpm test:rls
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";
import type { Database } from "../../lib/supabase/database.types";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url?.includes("127.0.0.1") && !url?.includes("localhost")) {
  throw new Error("RLS tests create and delete users: run them against the LOCAL Supabase only.");
}

type Client = SupabaseClient<Database>;
const admin: Client = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

interface Parent {
  client: Client;
  userId: string;
  householdId: string;
  kidId: string;
  choreId: string;
  submissionId: string;
}

const PASSWORD = `rls-${randomUUID()}`;
const created: string[] = [];

async function makeParent(label: string): Promise<Parent> {
  const email = `rls-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  created.push(u.user.id);
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;

  const { data: householdId, error: hhError } = await client.rpc("create_household", {
    p_name: `RLS ${label}`,
    p_timezone: "America/Toronto",
    p_currency: "CAD",
    p_locale: "en",
  });
  if (hhError) throw hhError;
  const { data: kid } = await client.from("kids").insert({ household_id: householdId, name: `Kid ${label}` }).select("id").single();
  const { data: chore } = await client
    .from("chores")
    .insert({ household_id: householdId, title: `Chore ${label}`, price_cents: 500, repeat_kind: "weekly" })
    .select("id")
    .single();
  const { data: sub } = await admin.rpc("kiosk_create_submission", {
    p_household_id: householdId,
    p_kid_id: kid!.id,
    p_chore_id: chore!.id,
    p_quantity: 1,
    p_idempotency_key: randomUUID(),
    p_device_id: randomUUID(),
    p_expected_last_id: null as unknown as string,
  });
  return { client, userId: u.user.id, householdId, kidId: kid!.id, choreId: chore!.id, submissionId: sub!.id };
}

let A: Parent;
let B: Parent;

beforeAll(async () => {
  A = await makeParent("a");
  B = await makeParent("b");
}, 30_000);

afterAll(async () => {
  for (const h of [A?.householdId, B?.householdId].filter(Boolean)) {
    await admin.from("households").delete().eq("id", h!);
  }
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

const TABLES = [
  "households",
  "household_members",
  "kids",
  "chores",
  "chore_assignees",
  "submissions",
  "submission_events",
  "ledger_entries",
  "devices",
  "subscriptions",
  "household_invites",
] as const;

describe("tenant isolation", () => {
  it("each parent sees their own household", async () => {
    const { data } = await A.client.from("households").select("id");
    expect(data?.map((h) => h.id)).toEqual([A.householdId]);
  });

  it.each(TABLES)("A cannot read B's %s", async (table) => {
    const column = table === "households" ? "id" : "household_id";
    // Dynamic table/column: the typed builder can't express the union.
    const { data, error } = await (A.client as unknown as SupabaseClient)
      .from(table)
      .select(column)
      .eq(column, B.householdId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("A cannot read B's balances", async () => {
    const { data } = await A.client.from("kid_balances").select("*").eq("kid_id", B.kidId);
    expect(data).toEqual([]);
  });

  it("A cannot insert kids, chores or ledger rows into B", async () => {
    const kid = await A.client.from("kids").insert({ household_id: B.householdId, name: "Intruder" });
    expect(kid.error).not.toBeNull();
    const chore = await A.client
      .from("chores")
      .insert({ household_id: B.householdId, title: "x", price_cents: 1, repeat_kind: "once" });
    expect(chore.error).not.toBeNull();
    const ledger = await A.client.from("ledger_entries").insert({
      household_id: B.householdId,
      kid_id: B.kidId,
      kind: "adjustment",
      amount_cents: 100000,
      created_by: A.userId,
    });
    expect(ledger.error).not.toBeNull();
  });

  it("A cannot move its own rows into B, or point at B's kid", async () => {
    const move = await A.client.from("kids").update({ household_id: B.householdId }).eq("id", A.kidId);
    expect(move.error).not.toBeNull();
    const cross = await A.client.from("ledger_entries").insert({
      household_id: A.householdId,
      kid_id: B.kidId,
      kind: "adjustment",
      amount_cents: 100,
      created_by: A.userId,
    });
    expect(cross.error).not.toBeNull();
  });

  it("A cannot update or delete B's rows (silently affects nothing)", async () => {
    await A.client.from("kids").update({ name: "Hacked" }).eq("id", B.kidId);
    await A.client.from("chores").delete().eq("id", B.choreId);
    await A.client.from("households").update({ name: "Hacked" }).eq("id", B.householdId);
    const { data: kid } = await admin.from("kids").select("name").eq("id", B.kidId).single();
    const { data: chore } = await admin.from("chores").select("id").eq("id", B.choreId).maybeSingle();
    const { data: hh } = await admin.from("households").select("name").eq("id", B.householdId).single();
    expect(kid?.name).toBe("Kid b");
    expect(chore?.id).toBe(B.choreId);
    expect(hh?.name).toBe("RLS b");
  });

  it("A cannot approve, send back or reject B's submissions", async () => {
    for (const call of [
      A.client.rpc("approve_submission", { p_submission_id: B.submissionId }),
      A.client.rpc("send_back_submission", { p_submission_id: B.submissionId, p_comment: "no" }),
      A.client.rpc("reject_submission", { p_submission_id: B.submissionId, p_reason: "no" }),
    ]) {
      expect((await call).error).not.toBeNull();
    }
    const { data } = await admin.from("submissions").select("status").eq("id", B.submissionId).single();
    expect(data?.status).toBe("pending");
  });

  it("A cannot read avatars in B's folder", async () => {
    await admin.storage.from("avatars").upload(`${B.householdId}/${B.kidId}.webp`, new Blob(["x"], { type: "image/webp" }), { upsert: true });
    const { data } = await A.client.storage.from("avatars").list(B.householdId);
    expect(data ?? []).toEqual([]);
    const up = await A.client.storage.from("avatars").upload(`${B.householdId}/evil.webp`, new Blob(["x"], { type: "image/webp" }));
    expect(up.error).not.toBeNull();
  });
});

describe("ledger is append-only", () => {
  it("approval writes an earning; nobody can update or delete it", async () => {
    const { error } = await A.client.rpc("approve_submission", { p_submission_id: A.submissionId });
    expect(error).toBeNull();
    const { data: rows } = await A.client.from("ledger_entries").select("id, amount_cents").eq("kid_id", A.kidId);
    expect(rows?.[0]?.amount_cents).toBe(500);

    await A.client.from("ledger_entries").update({ amount_cents: 999999 }).eq("id", rows![0]!.id);
    await A.client.from("ledger_entries").delete().eq("id", rows![0]!.id);
    const svcUpdate = await admin.from("ledger_entries").update({ amount_cents: 999999 }).eq("id", rows![0]!.id);
    const svcDelete = await admin.from("ledger_entries").delete().eq("id", rows![0]!.id);
    expect(svcUpdate.error?.message).toMatch(/append-only/);
    expect(svcDelete.error?.message).toMatch(/append-only/);

    const { data: after } = await admin.from("ledger_entries").select("amount_cents").eq("id", rows![0]!.id).single();
    expect(after?.amount_cents).toBe(500);
  });

  it("approving twice is idempotent (one earning)", async () => {
    await A.client.rpc("approve_submission", { p_submission_id: A.submissionId });
    const { count } = await admin
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", A.submissionId)
      .eq("kind", "earning");
    expect(count).toBe(1);
  });

  it("parents can't forge earnings directly", async () => {
    const { error } = await A.client.from("ledger_entries").insert({
      household_id: A.householdId,
      kid_id: A.kidId,
      kind: "earning",
      amount_cents: 100000,
      created_by: A.userId,
    });
    expect(error).not.toBeNull();
  });
});

describe("privilege boundaries", () => {
  it("a member cannot promote themselves or read PIN hashes", async () => {
    const promote = await A.client.from("household_members").update({ role: "owner" }).eq("user_id", A.userId);
    expect(promote.error).not.toBeNull();
    const pins = await A.client.from("household_members").select("pin_hash");
    expect(pins.error).not.toBeNull();
  });

  it("kiosk functions are not callable from a browser session", async () => {
    const { error } = await A.client.rpc("kiosk_resubmit", {
      p_household_id: A.householdId,
      p_kid_id: A.kidId,
      p_submission_id: A.submissionId,
    });
    expect(error).not.toBeNull();
  });

  it("parents can read but never write their subscription", async () => {
    const { data } = await A.client.from("subscriptions").select("plan").eq("household_id", A.householdId).single();
    expect(data?.plan).toBe("trial");
    await A.client.from("subscriptions").update({ plan: "comp" }).eq("household_id", A.householdId);
    const { data: after } = await admin.from("subscriptions").select("plan").eq("household_id", A.householdId).single();
    expect(after?.plan).toBe("trial");
  });

  it("anonymous visitors see nothing but templates", async () => {
    const anon = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
    for (const table of TABLES) {
      const { data } = await anon.from(table).select("*").limit(1);
      expect(data ?? []).toEqual([]);
    }
    const { data: templates } = await anon.from("chore_templates").select("key").limit(1);
    expect(templates?.length).toBe(1);
  });

  it("platform tables are invisible to parents", async () => {
    for (const table of ["platform_admins", "stripe_events", "audit_log"] as const) {
      const { data } = await A.client.from(table).select("*").limit(1);
      expect(data ?? []).toEqual([]);
    }
  });
});
