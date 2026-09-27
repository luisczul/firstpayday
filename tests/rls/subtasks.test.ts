/** Checklist chores: ticks are kiosk-only writes, isolated per household, and gate submissions. Local stack only. */
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
const PASSWORD = `sub-${randomUUID()}`;
const users: string[] = [];
const TZ = "America/Toronto";

const STEPS = [
  { id: "bed", title: "Make your bed", section: "Morning" },
  { id: "teeth", title: "Brush your teeth", section: "Morning" },
  { id: "read", title: "Read for 15 minutes" },
];

/** YYYY-MM-DD of `d` in the household timezone. */
const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function parent(label: string) {
  const email = `sub-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  users.push(u.user.id);
  const client: Client = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  const { data: householdId, error: hErr } = await client.rpc("create_household", { p_name: `Sub ${label}`, p_timezone: TZ, p_currency: "CAD", p_locale: "en" });
  if (hErr) throw hErr;
  const { data: kids } = await client
    .from("kids")
    .insert([{ household_id: householdId, name: `Kid ${label}1` }, { household_id: householdId, name: `Kid ${label}2` }])
    .select("id");
  const { data: chore, error: cErr } = await client
    .from("chores")
    .insert({ household_id: householdId, title: "Daily routine", price_cents: 10, repeat_kind: "daily", scope: "per_kid", subtasks: STEPS as unknown as NonNullable<Json> })
    .select("id")
    .single();
  if (cErr) throw cErr;
  return { client, householdId, kidId: kids![0]!.id, kid2Id: kids![1]!.id, choreId: chore.id };
}

const toggle = (h: { householdId: string }, kidId: string, choreId: string, subtaskId: string, checked = true) =>
  admin.rpc("kiosk_toggle_subtask", {
    p_household_id: h.householdId,
    p_kid_id: kidId,
    p_chore_id: choreId,
    p_subtask_id: subtaskId,
    p_checked: checked,
    p_device_id: null as unknown as string,
  });

const submit = (h: { householdId: string }, kidId: string, choreId: string) =>
  admin.rpc("kiosk_create_submission", {
    p_household_id: h.householdId,
    p_kid_id: kidId,
    p_chore_id: choreId,
    p_quantity: 1,
    p_idempotency_key: randomUUID(),
    p_device_id: randomUUID(),
    p_expected_last_id: null as unknown as string,
  });

let a: Awaited<ReturnType<typeof parent>>;
let b: Awaited<ReturnType<typeof parent>>;

beforeAll(async () => {
  a = await parent("a");
  b = await parent("b");
});
afterAll(async () => {
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

describe("checklist chores", () => {
  it("rejects malformed subtask lists", async () => {
    const bad: NonNullable<Json>[] = [
      [{ id: "x", title: "A" }, { id: "x", title: "B" }],
      [{ id: "x", title: "  " }],
      [{ id: "bad id", title: "A" }],
      [{ id: "x", title: "A", section: 3 }],
      Array.from({ length: 21 }, (_, i) => ({ id: `s${i}`, title: "A" })),
      { id: "x" },
    ];
    for (const subtasks of bad) {
      const { error } = await a.client.from("chores").insert({ household_id: a.householdId, title: "Bad", price_cents: 10, repeat_kind: "daily", subtasks });
      expect(error, JSON.stringify(subtasks)).not.toBeNull();
    }
  });

  it("parents can't write ticks or call the kiosk functions", async () => {
    const row = { household_id: a.householdId, kid_id: a.kidId, chore_id: a.choreId, subtask_id: "bed", period_key: localDate(new Date()) };
    expect((await a.client.from("chore_subtask_checks").insert(row)).error).not.toBeNull();
    expect(
      (await a.client.rpc("kiosk_toggle_subtask", { p_household_id: a.householdId, p_kid_id: a.kidId, p_chore_id: a.choreId, p_subtask_id: "bed", p_checked: true, p_device_id: null as unknown as string })).error,
    ).not.toBeNull();
    expect((await a.client.rpc("kiosk_checklist_progress", { p_household_id: a.householdId, p_kid_id: a.kidId })).error).not.toBeNull();
    const anon: Client = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    expect((await anon.from("chore_subtask_checks").insert(row)).error).not.toBeNull();
    expect((await admin.from("chore_subtask_checks").select("kid_id").eq("chore_id", a.choreId)).data).toEqual([]);
  });

  it("the kiosk ticks for today; parents read only their own household", async () => {
    const { data, error } = await toggle(a, a.kidId, a.choreId, "bed");
    expect(error).toBeNull();
    expect(data).toEqual({ period_key: localDate(new Date()), checked: ["bed"] });
    // Ticking twice is harmless; unticking removes it.
    await toggle(a, a.kidId, a.choreId, "teeth");
    await toggle(a, a.kidId, a.choreId, "teeth");
    expect((await toggle(a, a.kidId, a.choreId, "teeth", false)).data).toMatchObject({ checked: ["bed"] });

    expect((await a.client.from("chore_subtask_checks").select("subtask_id")).data).toEqual([{ subtask_id: "bed" }]);
    expect((await b.client.from("chore_subtask_checks").select("subtask_id")).data).toEqual([]);
    // Another household's tablet can't touch A's chore or kid; unknown steps are refused.
    expect((await toggle(b, a.kidId, a.choreId, "bed")).error?.message).toMatch(/chore_unavailable/);
    expect((await toggle(b, a.kidId, b.choreId, "bed")).error?.message).toMatch(/kid_not_found/);
    expect((await toggle(a, a.kidId, a.choreId, "nope")).error?.message).toMatch(/subtask_not_found/);
    // Progress is per kid.
    const { data: p2 } = await admin.rpc("kiosk_checklist_progress", { p_household_id: a.householdId, p_kid_id: a.kid2Id });
    expect(p2).toEqual({ [a.choreId]: { period_key: localDate(new Date()), checked: [] } });
    expect((await admin.rpc("kiosk_checklist_progress", { p_household_id: b.householdId, p_kid_id: a.kidId })).data).toEqual({});
  });

  it("an assigned checklist only takes ticks from its kids", async () => {
    await a.client.from("chore_assignees").insert({ chore_id: a.choreId, kid_id: a.kidId, household_id: a.householdId });
    expect((await toggle(a, a.kid2Id, a.choreId, "bed")).error?.message).toMatch(/kid_not_found/);
    await a.client.from("chore_assignees").delete().eq("chore_id", a.choreId);
  });

  it("the server refuses to submit until every step is ticked", async () => {
    await toggle(a, a.kidId, a.choreId, "teeth");
    const early = await submit(a, a.kidId, a.choreId);
    expect(early.error?.message).toMatch(/checklist_incomplete/);
    expect((await admin.from("submissions").select("id").eq("chore_id", a.choreId)).data).toEqual([]);

    await toggle(a, a.kidId, a.choreId, "read");
    const ok = await submit(a, a.kidId, a.choreId);
    expect(ok.error).toBeNull();
    expect(ok.data?.status).toBe("pending");
    // Kid 2 ticked nothing: their own submission is refused.
    expect((await submit(a, a.kid2Id, a.choreId)).error?.message).toMatch(/checklist_incomplete/);
  });

  it("yesterday's ticks don't count today, and a new step must be ticked too", async () => {
    const today = localDate(new Date());
    await toggle(a, a.kid2Id, a.choreId, "bed");
    await toggle(a, a.kid2Id, a.choreId, "teeth");
    await toggle(a, a.kid2Id, a.choreId, "read");
    await admin.from("chore_subtask_checks").update({ period_key: addDays(today, -1) }).eq("kid_id", a.kid2Id);
    const { data } = await admin.rpc("kiosk_checklist_progress", { p_household_id: a.householdId, p_kid_id: a.kid2Id });
    expect(data).toEqual({ [a.choreId]: { period_key: today, checked: [] } });
    expect((await submit(a, a.kid2Id, a.choreId)).error?.message).toMatch(/checklist_incomplete/);

    for (const s of STEPS) await toggle(a, a.kid2Id, a.choreId, s.id);
    // The next tick clears the old period's rows.
    expect((await admin.from("chore_subtask_checks").select("period_key").eq("kid_id", a.kid2Id)).data?.every((r) => r.period_key === today)).toBe(true);
    await admin.from("chores").update({ subtasks: [...STEPS, { id: "floss", title: "Floss" }] as unknown as NonNullable<Json> }).eq("id", a.choreId);
    expect((await submit(a, a.kid2Id, a.choreId)).error?.message).toMatch(/checklist_incomplete/);
    await toggle(a, a.kid2Id, a.choreId, "floss");
    expect((await submit(a, a.kid2Id, a.choreId)).error).toBeNull();
  });

  it("period keys follow the chore's repeat (once / weekly / every n days)", async () => {
    const now = new Date();
    const today = localDate(now);
    const mk = async (fields: Partial<Database["public"]["Tables"]["chores"]["Insert"]>) => {
      const { data, error } = await admin
        .from("chores")
        .insert({ household_id: b.householdId, title: "Routine", price_cents: 10, repeat_kind: "daily", subtasks: STEPS as unknown as NonNullable<Json>, ...fields })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    };
    const key = async (choreId: string) => (await toggle(b, b.kidId, choreId, "bed")).data as { period_key: string };

    expect((await key(await mk({ repeat_kind: "once" }))).period_key).toBe("once");

    // Weekly: the local day the week started (households.week_starts_on, 0 = Sunday by default).
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    const { data: hh } = await admin.from("households").select("week_starts_on").eq("id", b.householdId).single();
    expect((await key(await mk({ repeat_kind: "weekly" }))).period_key).toBe(addDays(today, -((dow - hh!.week_starts_on + 7) % 7)));

    // Every 3 days, created 7 days ago and never done: periods start on days 0, 3, 6; today is day 7.
    const created = new Date(now.getTime() - 7 * 86_400_000);
    const every3 = await mk({ repeat_kind: "every_n_days", repeat_every_days: 3, created_at: created.toISOString() });
    expect((await key(every3)).period_key).toBe(addDays(localDate(created), 6));
  });
});
