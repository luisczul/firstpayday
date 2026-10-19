import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Owner's report: "Tire 1", whole house, weekly, max quantity 2. Liam did 1 and it's waiting for a
// check; Camila must still be able to do the other one (only one), then it waits for next week.
test.setTimeout(240_000);

type Card = { choreId: string; title: string; maxQuantity: number; expectedLastId: string | null };
type Board = { sections: Record<"inProgress" | "new" | "ready" | "fix" | "waiting" | "soon", Card[]> };

async function board(request: APIRequestContext, kidId: string): Promise<Board> {
  const r = await request.get(`/api/kiosk/board?kidId=${kidId}`);
  expect(r.status()).toBe(200);
  return r.json();
}
const tappable = (b: Board, title: string) => [...b.sections.new, ...b.sections.ready].find((c) => c.title === title);
const submit = (request: APIRequestContext, kidId: string, choreId: string, quantity: number, expectedLastId: string | null) =>
  request.post("/api/kiosk/submit", { data: { kidId, choreId, quantity, idempotencyKey: `tire-${randomUUID()}`, expectedLastId } });

test("2 tires a week: one kid does 1, the other can still do the last one, then it waits", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const kid: Page = await ctx.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(`tire-${randomUUID().slice(0, 8)}@example.test`);
  await kid.getByLabel("Password").fill(`tire-${randomUUID()}`);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  const home = `Tire family ${randomUUID().slice(0, 6)}`;
  await kid.getByLabel("Home name").fill(home);
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Liam");
  await kid.getByRole("button", { name: "+ Add another" }).click();
  await kid.getByLabel("Kid 2 name").fill("Camila");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();

  const { data: hh } = await admin.from("households").select("id").eq("name", home).single();
  const { data: kids } = await admin.from("kids").select("id, name").eq("household_id", hh!.id);
  const liam = kids!.find((k) => k.name === "Liam")!.id;
  const camila = kids!.find((k) => k.name === "Camila")!.id;
  const { data: chore } = await admin
    .from("chores")
    .insert({ household_id: hh!.id, title: "Tire 1", emoji: "🚗", price_cents: 100, unit_label: "tire", max_quantity: 2, repeat_kind: "weekly", scope: "household" })
    .select("id")
    .single();
  const tireId = chore!.id;
  const req = kid.request;

  // Liam does 1 of 2 (waiting for a check).
  const liamCard = tappable(await board(req, liam), "Tire 1")!;
  expect(liamCard.maxQuantity).toBe(2);
  expect((await submit(req, liam, tireId, 1, liamCard.expectedLastId)).status()).toBe(200);

  // Camila: still on her board, for the 1 tire that's left.
  const camilaCard = tappable(await board(req, camila), "Tire 1");
  expect(camilaCard?.maxQuantity).toBe(1);
  // Asking for 2 is refused: only 1 is left.
  const tooMany = await submit(req, camila, tireId, 2, camilaCard!.expectedLastId);
  expect(tooMany.status()).toBe(409);

  // On screen: the card is there to tap, not greyed out under "waiting".
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: /Camila/ }).click();
  await expect(kid.getByRole("heading", { name: "Camila" })).toBeVisible({ timeout: 40_000 });
  await expect(kid.getByRole("button", { name: "Tire 1", exact: true }).first()).toBeEnabled();

  expect((await submit(req, camila, tireId, 1, camilaCard!.expectedLastId)).status()).toBe(200);

  // Both tires done this week: nobody can do a third.
  expect(tappable(await board(req, liam), "Tire 1")).toBeUndefined();
  expect(tappable(await board(req, camila), "Tire 1")).toBeUndefined();
  const latest = (await admin.from("submissions").select("id").eq("chore_id", tireId).order("submitted_at", { ascending: false }).limit(1).single()).data!.id;
  expect((await submit(req, liam, tireId, 1, latest)).status()).toBe(409);
  const { data: subs } = await admin.from("submissions").select("kid_id, quantity").eq("chore_id", tireId);
  expect(subs!.map((s) => s.quantity).reduce((a, b) => a + b, 0)).toBe(2);
  await ctx.close();
});
