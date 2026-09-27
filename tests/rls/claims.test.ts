/** Chore claims ("I'm on it!"): kiosk-only writes, parents read and release their own home's. Local stack only. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";
import type { Database, Json } from "../../lib/supabase/database.types";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url?.includes("127.0.0.1") && !url?.includes("localhost")) throw new Error("Run against the LOCAL Supabase only.");
type Client = SupabaseClient<Database>;
const admin: Client = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PASSWORD = `clm-${randomUUID()}`;
const users: string[] = [];
const TZ = "America/Toronto";

async function parent(label: string) {
  const email = `clm-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  users.push(u.user.id);
  const client: Client = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  const { data: householdId, error: hErr } = await client.rpc("create_household", { p_name: `Clm ${label}`, p_timezone: TZ, p_currency: "CAD", p_locale: "en" });
  if (hErr) throw hErr;
  const { data: kids } = await client
    .from("kids")
    .insert([{ household_id: householdId, name: `Liam ${label}` }, { household_id: householdId, name: `Camila ${label}` }])
    .select("id, name")
    .order("name", { ascending: false });
  const chore = async (title: string, extra: Partial<Database["public"]["Tables"]["chores"]["Insert"]> = {}) => {
    const { data, error: cErr } = await client
      .from("chores")
      .insert({ household_id: householdId, title, price_cents: 200, repeat_kind: "every_n_days", repeat_every_days: 14, scope: "household", ...extra })
      .select("id")
      .single();
    if (cErr) throw cErr;
    return data.id;
  };
  return { client, userId: u.user.id, householdId, liam: kids![0]!.id, camila: kids![1]!.id, chore };
}

type Home = Awaited<ReturnType<typeof parent>>;

const claim = (h: Home, kidId: string, choreId: string, quantity = 1) =>
  admin.rpc("kiosk_claim_chore", { p_household_id: h.householdId, p_kid_id: kidId, p_chore_id: choreId, p_device_id: null as unknown as string, p_quantity: quantity });
const submit = (h: Home, kidId: string, choreId: string, quantity = 1) =>
  admin.rpc("kiosk_create_submission", {
    p_household_id: h.householdId,
    p_kid_id: kidId,
    p_chore_id: choreId,
    p_quantity: quantity,
    p_idempotency_key: randomUUID(),
    p_device_id: randomUUID(),
    p_expected_last_id: null as unknown as string,
  });
const hoursFromNow = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3_600_000;

let a: Home;
let b: Home;

beforeAll(async () => {
  a = await parent("a");
  b = await parent("b");
});
afterAll(async () => {
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

describe("claiming (kiosk, service role)", () => {
  it("a kid claims a free whole-house chore for 24 hours by default; a sibling can't claim or submit it", async () => {
    const garage = await a.chore("Garage sweep");
    const { data, error } = await claim(a, a.liam, garage);
    expect(error).toBeNull();
    expect(hoursFromNow(data!.expires_at)).toBeGreaterThan(23.9);
    expect(hoursFromNow(data!.expires_at)).toBeLessThan(24.1);
    // Same tap twice: same claim.
    expect((await claim(a, a.liam, garage)).data?.id).toBe(data!.id);
    expect((await claim(a, a.camila, garage)).error?.message).toContain("chore_claimed");
    expect((await submit(a, a.camila, garage)).error?.message).toContain("chore_claimed");

    // The claimer sends it in: the claim is completed with the submission.
    const { data: sub, error: sErr } = await submit(a, a.liam, garage);
    expect(sErr).toBeNull();
    const { data: after } = await admin.from("chore_claims").select("release_reason, submission_id, released_at").eq("id", data!.id).single();
    expect(after).toMatchObject({ release_reason: "completed", submission_id: sub!.id });
    // Now it's resting (cooldown): nobody can claim it.
    expect((await claim(a, a.camila, garage)).error?.message).toContain("chore_unavailable");
  });

  it("each-kid chores and routines can't be claimed; the chore's own time limit sets the expiry", async () => {
    const bed = await a.chore("Make your bed", { scope: "per_kid" });
    const routine = await a.chore("Routine", { scope: "per_kid", subtasks: [{ id: "a", title: "A" }] as unknown as NonNullable<Json> });
    expect((await claim(a, a.liam, bed)).error?.message).toContain("chore_unavailable");
    expect((await claim(a, a.liam, routine)).error?.message).toContain("chore_unavailable");

    const quick = await a.chore("Quick", { claim_window: "2h" });
    expect(hoursFromNow((await claim(a, a.camila, quick)).data!.expires_at)).toBeCloseTo(2, 1);
    const eod = await a.chore("Tonight", { claim_window: "end_of_day" });
    const { data: e } = await claim(a, a.camila, eod);
    // Next local midnight in the household timezone.
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(e!.expires_at));
    expect(local).toBe("00:00");
    expect(hoursFromNow(e!.expires_at)).toBeLessThanOrEqual(24);
    // Camila has 2: a third is refused.
    const third = await a.chore("Third");
    expect((await claim(a, a.camila, third)).error?.message).toContain("claim_limit");
    expect((await a.client.from("chores").update({ claim_window: "forever" }).eq("id", third)).error).not.toBeNull();
  });

  it("quantity: 1..max when claiming, then no more than claimed when sending it in", async () => {
    const base = await a.chore("Baseboards", { max_quantity: 3, unit_label: "floor" });
    expect((await claim(a, a.liam, base, 4)).error?.message).toContain("quantity");
    expect((await claim(a, a.liam, base, 0)).error?.message).toContain("quantity");
    const { data } = await claim(a, a.liam, base, 2);
    expect(data?.quantity).toBe(2);
    expect((await submit(a, a.liam, base, 3)).error?.message).toContain("quantity");
    const { data: sub } = await submit(a, a.liam, base, 1);
    expect(sub).toMatchObject({ quantity: 1, amount_cents: 200 });
  });

  it("give it back, or time runs out: free again for everyone", async () => {
    const terrace = await a.chore("Terrace");
    const { data } = await claim(a, a.liam, terrace);
    const { data: back } = await admin.rpc("kiosk_release_claim", { p_household_id: a.householdId, p_kid_id: a.liam, p_claim_id: data!.id });
    expect(back?.release_reason).toBe("given_back");
    // Only the kid who holds it can give it back.
    expect((await admin.rpc("kiosk_release_claim", { p_household_id: a.householdId, p_kid_id: a.camila, p_claim_id: data!.id })).error?.message).toContain("claim_not_found");
    // Free again (Camila already holds 2 claims, so Liam takes it once more).
    const { data: c2 } = await claim(a, a.liam, terrace);
    expect(c2?.id).not.toBe(data!.id);
    expect((await submit(a, a.camila, terrace)).error?.message).toContain("chore_claimed");
    // Expired (lazy): no cron, the chore just opens up.
    await admin.from("chore_claims").update({ claimed_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", c2!.id);
    expect((await submit(a, a.camila, terrace)).error).toBeNull();
  });
});

describe("row-level security", () => {
  it("parents read their own home's claims only, and can't write them", async () => {
    const mine = await a.client.from("chore_claims").select("id, household_id");
    expect(mine.data!.length).toBeGreaterThan(0);
    expect(mine.data!.every((r) => r.household_id === a.householdId)).toBe(true);
    expect((await b.client.from("chore_claims").select("id")).data).toEqual([]);

    const choreId = (await a.client.from("chores").select("id").eq("title", "Garage sweep").single()).data!.id;
    const ins = await a.client.from("chore_claims").insert({ household_id: a.householdId, chore_id: choreId, kid_id: a.liam, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    expect(ins.error).not.toBeNull();
    const some = mine.data![0]!.id;
    await a.client.from("chore_claims").update({ expires_at: new Date(Date.now() + 99 * 3_600_000).toISOString() }).eq("id", some);
    await a.client.from("chore_claims").delete().eq("id", some);
    expect((await admin.from("chore_claims").select("id").eq("id", some)).data).toHaveLength(1);
  });

  it("kiosk claim functions can't be called from a parent's browser session", async () => {
    const choreId = await b.chore("Kiosk only");
    const c = await b.client.rpc("kiosk_claim_chore", { p_household_id: b.householdId, p_kid_id: b.liam, p_chore_id: choreId, p_device_id: null as unknown as string, p_quantity: 1 });
    expect(c.error).not.toBeNull();
    const r = await b.client.rpc("kiosk_release_claim", { p_household_id: b.householdId, p_kid_id: b.liam, p_claim_id: randomUUID() });
    expect(r.error).not.toBeNull();
    const o = await b.client.rpc("chore_open_for_claim", { p_chore_id: choreId, p_kid_id: b.liam, p_at: new Date().toISOString() });
    expect(o.error).not.toBeNull();
    expect((await admin.from("chore_claims").select("id").eq("chore_id", choreId)).data).toEqual([]);
  });

  it("parent_release_claim works only for members of that home", async () => {
    const choreId = await b.chore("Release me");
    const { data } = await claim(b, b.liam, choreId);
    // Another home's parent: not found, nothing changes.
    expect((await a.client.rpc("parent_release_claim", { p_claim_id: data!.id })).error).not.toBeNull();
    expect((await admin.from("chore_claims").select("released_at").eq("id", data!.id).single()).data?.released_at).toBeNull();
    const { data: released, error } = await b.client.rpc("parent_release_claim", { p_claim_id: data!.id });
    expect(error).toBeNull();
    expect(released?.release_reason).toBe("parent");
    // Free again: Camila can take it.
    expect((await claim(b, b.camila, choreId)).error).toBeNull();
  });
});
