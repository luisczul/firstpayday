/** Family tax on payouts and promotion bonuses: ledger rows, undo, and who may write what. Local stack only. */
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
const PASSWORD = `tax-${randomUUID()}`;
const users: string[] = [];
const homes: string[] = [];

async function parent(label: string) {
  const email = `tax-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  users.push(u.user.id);
  const client: Client = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  const { data: householdId, error: hErr } = await client.rpc("create_household", {
    p_name: `Tax ${label}`,
    p_timezone: "America/Toronto",
    p_currency: "CAD",
    p_locale: "en",
  });
  if (hErr) throw hErr;
  homes.push(householdId);
  const { data: kid } = await client.from("kids").insert({ household_id: householdId, name: `Kid ${label}` }).select("id").single();
  return { client, userId: u.user.id, householdId, kidId: kid!.id };
}
type Parent = Awaited<ReturnType<typeof parent>>;

/** A fresh chore + a kid's "I did it!" on the tablet (pending approval). */
async function submit(p: Parent, priceCents: number) {
  const { data: chore, error } = await p.client
    .from("chores")
    .insert({ household_id: p.householdId, title: `Chore ${randomUUID().slice(0, 4)}`, price_cents: priceCents, repeat_kind: "daily" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: sub, error: sErr } = await admin.rpc("kiosk_create_submission", {
    p_household_id: p.householdId,
    p_kid_id: p.kidId,
    p_chore_id: chore!.id,
    p_quantity: 1,
    p_idempotency_key: randomUUID(),
    p_device_id: randomUUID(),
    p_expected_last_id: null as unknown as string,
  });
  if (sErr) throw sErr;
  return sub!.id;
}

async function approve(p: Parent, submissionId: string) {
  const { error } = await p.client.rpc("approve_submission", { p_submission_id: submissionId });
  expect(error).toBeNull();
}

const balance = async (p: Parent) =>
  (await admin.from("kid_balances").select("balance_cents").eq("kid_id", p.kidId).single()).data?.balance_cents ?? 0;
const rowsFor = async (submissionId: string) =>
  (await admin.from("ledger_entries").select("kind, amount_cents, note").eq("submission_id", submissionId).order("created_at")).data ?? [];
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

let a: Parent;
let b: Parent;

beforeAll(async () => {
  a = await parent("a");
  b = await parent("b");
}, 30_000);
afterAll(async () => {
  for (const id of homes) await admin.from("households").delete().eq("id", id);
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

describe("family tax", () => {
  it("is off by default: a payout is paid in full", async () => {
    const { data: h } = await a.client.from("households").select("tax_enabled, tax_percent").eq("id", a.householdId).single();
    expect(h).toEqual({ tax_enabled: false, tax_percent: 10 });
    await approve(a, await submit(a, 300));
    const { data, error } = await a.client.rpc("record_payout", { p_kid_id: a.kidId, p_gross_cents: 300, p_method: "cash" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ gross_cents: 300, tax_cents: 0, net_cents: 300 });
    expect(await balance(a)).toBe(0);
    const { count } = await admin.from("ledger_entries").select("id", { count: "exact", head: true }).eq("kid_id", a.kidId).eq("kind", "tax");
    expect(count).toBe(0);
  });

  it("withholds the tax: $10 at 10% → payout -$9 and a tax row -$1 tied to it, balance 0", async () => {
    expect((await a.client.from("households").update({ tax_enabled: true, tax_percent: 10 }).eq("id", a.householdId)).error).toBeNull();
    await approve(a, await submit(a, 1000));
    expect(await balance(a)).toBe(1000);
    const { data, error } = await a.client.rpc("record_payout", { p_kid_id: a.kidId, p_gross_cents: 1000, p_method: "cash", p_note: "Saturday" });
    expect(error).toBeNull();
    const r = data as { payout_id: string; tax_cents: number; net_cents: number };
    expect(r).toMatchObject({ tax_cents: 100, net_cents: 900 });
    const { data: rows } = await admin.from("ledger_entries").select("id, kind, amount_cents, payout_id, method, note, created_by").or(`id.eq.${r.payout_id},payout_id.eq.${r.payout_id}`);
    const payout = rows!.find((x) => x.kind === "payout")!;
    const tax = rows!.find((x) => x.kind === "tax")!;
    expect(payout).toMatchObject({ amount_cents: -900, method: "cash", note: "Saturday", payout_id: null, created_by: a.userId });
    expect(tax).toMatchObject({ amount_cents: -100, payout_id: payout.id, note: "Family tax 10%", created_by: a.userId });
    expect(await balance(a)).toBe(0);
  });

  it("refuses payouts over the balance unless negatives are allowed, and bad input", async () => {
    expect((await a.client.rpc("record_payout", { p_kid_id: a.kidId, p_gross_cents: 500, p_method: "cash" })).error?.message).toMatch(/exceeds balance/);
    expect((await a.client.rpc("record_payout", { p_kid_id: a.kidId, p_gross_cents: 0, p_method: "cash" })).error).not.toBeNull();
    expect((await a.client.rpc("record_payout", { p_kid_id: a.kidId, p_gross_cents: 100, p_method: "crypto" })).error).not.toBeNull();
    const { data } = await a.client.rpc("record_payout", { p_kid_id: a.kidId, p_gross_cents: 200, p_method: "bank", p_allow_negative: true });
    expect(data).toMatchObject({ tax_cents: 20, net_cents: 180 });
    expect(await balance(a)).toBe(-200);
    // Put the balance back to zero for the next tests.
    await a.client.from("ledger_entries").insert({ household_id: a.householdId, kid_id: a.kidId, kind: "adjustment", amount_cents: 200, note: "reset", created_by: a.userId });
  });

  it("parents can't write tax rows directly or pay out another home's kid", async () => {
    const { data: payout } = await admin.from("ledger_entries").select("id").eq("kid_id", a.kidId).eq("kind", "payout").limit(1).single();
    const direct = await a.client.from("ledger_entries").insert({ household_id: a.householdId, kid_id: a.kidId, kind: "tax", amount_cents: -100, payout_id: payout!.id, created_by: a.userId });
    expect(direct.error).not.toBeNull();
    const linked = await a.client.from("ledger_entries").insert({ household_id: a.householdId, kid_id: a.kidId, kind: "payout", amount_cents: -100, payout_id: payout!.id, created_by: a.userId });
    expect(linked.error).not.toBeNull();
    const cross = await b.client.rpc("record_payout", { p_kid_id: a.kidId, p_gross_cents: 100, p_method: "cash", p_allow_negative: true });
    expect(cross.error).not.toBeNull();
    expect(await balance(a)).toBe(0);
  });

  it("family treats spend the pot; append-only and per household", async () => {
    expect((await a.client.from("family_pot_spends").insert({ household_id: a.householdId, amount_cents: 50, note: "Ice cream", created_by: a.userId })).error).toBeNull();
    expect((await b.client.from("family_pot_spends").insert({ household_id: a.householdId, amount_cents: 50, note: "x", created_by: b.userId })).error).not.toBeNull();
    expect((await b.client.from("family_pot_spends").select("id").eq("household_id", a.householdId)).data).toEqual([]);
    await a.client.from("family_pot_spends").update({ amount_cents: 1 }).eq("household_id", a.householdId);
    await a.client.from("family_pot_spends").delete().eq("household_id", a.householdId);
    const { data } = await admin.from("family_pot_spends").select("amount_cents").eq("household_id", a.householdId);
    expect(data).toEqual([{ amount_cents: 50 }]);
  });
});

describe("promotions", () => {
  it("no bonus for a chore submitted outside every window", async () => {
    const { error } = await b.client.from("promotions").insert({
      household_id: b.householdId, name: "Last week", starts_at: hoursFromNow(-5), ends_at: hoursFromNow(-2), bonus_kind: "flat", bonus_value: 100,
    });
    expect(error).toBeNull();
    const sub = await submit(b, 500);
    await approve(b, sub);
    expect((await rowsFor(sub)).map((r) => r.kind)).toEqual(["earning"]);
    expect(await balance(b)).toBe(500);
  });

  it("a chore submitted inside the window earns the bonus, even when approved after it ends", async () => {
    const { data: promo } = await b.client
      .from("promotions")
      .insert({ household_id: b.householdId, name: "Saturday blitz", starts_at: hoursFromNow(-1), ends_at: hoursFromNow(2), bonus_kind: "flat", bonus_value: 100 })
      .select("id")
      .single();
    const sub = await submit(b, 500);
    // End it early before the parent gets to the approval.
    expect((await b.client.from("promotions").update({ ends_at: new Date().toISOString() }).eq("id", promo!.id)).error).toBeNull();
    const late = await submit(b, 500); // submitted after it ended: no bonus
    await approve(b, sub);
    await approve(b, late);
    const rows = await rowsFor(sub);
    expect(rows.map((r) => [r.kind, r.amount_cents])).toEqual([["earning", 500], ["promo", 100]]);
    expect(rows[1]!.note).toBe("Promotion: Saturday blitz");
    expect((await rowsFor(late)).map((r) => r.kind)).toEqual(["earning"]);
    expect(await balance(b)).toBe(500 + 600 + 500);
    // Approving twice never pays the bonus twice.
    await approve(b, sub);
    expect((await rowsFor(sub)).length).toBe(2);
  });

  it("overlapping promotions don't stack; percent is of the chore amount", async () => {
    await b.client.from("promotions").insert([
      { household_id: b.householdId, name: "Flat", starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1), bonus_kind: "flat", bonus_value: 100 },
      { household_id: b.householdId, name: "Twenty", starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1), bonus_kind: "percent", bonus_value: 20 },
    ]);
    const big = await submit(b, 1000); // 20% = $2 beats $1
    const small = await submit(b, 250); // $1 beats 20% = $0.50
    await approve(b, big);
    await approve(b, small);
    expect((await rowsFor(big)).filter((r) => r.kind === "promo").map((r) => [r.amount_cents, r.note])).toEqual([[200, "Promotion: Twenty"]]);
    expect((await rowsFor(small)).filter((r) => r.kind === "promo").map((r) => [r.amount_cents, r.note])).toEqual([[100, "Promotion: Flat"]]);
  });

  it("undo (reopen_submission) takes the promotion back too; re-approving pays it again", async () => {
    const sub = await submit(b, 400);
    await approve(b, sub);
    const before = await balance(b);
    const { error } = await b.client.rpc("reopen_submission", { p_submission_id: sub, p_comment: "Not done", p_mode: "revision" });
    expect(error).toBeNull();
    const net = (await rowsFor(sub)).reduce((s, r) => s + r.amount_cents, 0);
    expect(net).toBe(0);
    expect(await balance(b)).toBe(before - 400 - 100); // flat $1 beats 20% of $4
    await admin.rpc("kiosk_resubmit", { p_household_id: b.householdId, p_kid_id: b.kidId, p_submission_id: sub });
    await approve(b, sub);
    expect(await balance(b)).toBe(before);
  });

  it("auto-approved chores get the bonus right away", async () => {
    const { data: chore } = await b.client
      .from("chores")
      .insert({ household_id: b.householdId, title: "Auto", price_cents: 300, repeat_kind: "daily", requires_approval: false })
      .select("id")
      .single();
    const { data: sub } = await admin.rpc("kiosk_create_submission", {
      p_household_id: b.householdId, p_kid_id: b.kidId, p_chore_id: chore!.id, p_quantity: 1,
      p_idempotency_key: randomUUID(), p_device_id: randomUUID(), p_expected_last_id: null as unknown as string,
    });
    expect((await rowsFor(sub!.id)).map((r) => [r.kind, r.amount_cents])).toEqual([["earning", 300], ["promo", 100]]);
  });

  it("parents can't write promo ledger rows or call the bonus helper", async () => {
    const sub = await submit(b, 100);
    const direct = await b.client.from("ledger_entries").insert({ household_id: b.householdId, kid_id: b.kidId, kind: "promo", amount_cents: 1000, created_by: b.userId });
    expect(direct.error).not.toBeNull();
    const tied = await b.client.from("ledger_entries").insert({ household_id: b.householdId, kid_id: b.kidId, kind: "adjustment", amount_cents: 1000, submission_id: sub, created_by: b.userId });
    expect(tied.error).not.toBeNull();
    const helper = await b.client.rpc("promo_bonus_at", { p_household_id: b.householdId, p_at: new Date().toISOString(), p_amount_cents: 100 });
    expect(helper.error).not.toBeNull();
  });

  it("promotions are private to each household and validated", async () => {
    expect((await a.client.from("promotions").select("id").eq("household_id", b.householdId)).data).toEqual([]);
    const intrude = await a.client.from("promotions").insert({ household_id: b.householdId, name: "x", starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1), bonus_kind: "flat", bonus_value: 5000 });
    expect(intrude.error).not.toBeNull();
    await a.client.from("promotions").update({ bonus_value: 10000 }).eq("household_id", b.householdId);
    const { data: bs } = await admin.from("promotions").select("bonus_value").eq("household_id", b.householdId);
    expect(bs!.some((p) => p.bonus_value === 10000)).toBe(false);
    await a.client.from("promotions").delete().eq("household_id", b.householdId);
    expect((await admin.from("promotions").select("id").eq("household_id", b.householdId)).data!.length).toBe(4);
    // Bad windows / values are refused.
    expect((await a.client.from("promotions").insert({ household_id: a.householdId, name: "Backwards", starts_at: hoursFromNow(2), ends_at: hoursFromNow(1), bonus_kind: "flat", bonus_value: 100 })).error).not.toBeNull();
    expect((await a.client.from("promotions").insert({ household_id: a.householdId, name: "Huge", starts_at: hoursFromNow(1), ends_at: hoursFromNow(2), bonus_kind: "percent", bonus_value: 500 })).error).not.toBeNull();
    // Future promotions can be deleted; running ones can only be ended.
    const { data: future } = await a.client.from("promotions").insert({ household_id: a.householdId, name: "Soon", starts_at: hoursFromNow(1), ends_at: hoursFromNow(2), bonus_kind: "flat", bonus_value: 100 }).select("id").single();
    const { data: running } = await a.client.from("promotions").insert({ household_id: a.householdId, name: "Now", starts_at: hoursFromNow(-1), ends_at: hoursFromNow(2), bonus_kind: "flat", bonus_value: 100 }).select("id").single();
    await a.client.from("promotions").delete().in("id", [future!.id, running!.id]);
    const { data: left } = await admin.from("promotions").select("name").eq("household_id", a.householdId);
    expect(left!.map((p) => p.name)).toEqual(["Now"]);
  });
});
