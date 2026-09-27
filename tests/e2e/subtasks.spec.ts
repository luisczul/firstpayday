import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Checklist chores (a chore with subtasks): parent builds one, kid ticks steps on the
// tablet, can't submit until every step is done, parent approves, next day starts fresh.
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const email = `steps-${randomUUID().slice(0, 8)}@example.test`;
const password = `steps-${randomUUID()}`;
let kid: Page;
let parent: Page;
let householdId = "";
let noraId = "";

async function openBoard() {
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: /Nora/ }).click();
  await expect(kid.getByRole("heading", { name: "Nora" })).toBeVisible({ timeout: 40_000 });
}

const card = (title: string) => kid.getByRole("button", { name: title, exact: true });

test("setup: home with Nora, every template but the Morning routine", async ({ browser }) => {
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  kid = await tablet.newPage();
  await kid.goto("/signup");
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();
  await kid.getByLabel("Home name").fill("Steps family");
  await kid.getByLabel("Currency").selectOption("CAD");
  await kid.getByLabel("Language").selectOption("en");
  await kid.getByRole("button", { name: /add your kids/ }).click();
  await kid.getByLabel("Kid 1 name").fill("Nora");
  await kid.getByRole("button", { name: /pick chores/ }).click();
  // Routines are templates too; skip the morning one to add it later from Admin.
  const morning = kid.getByRole("button", { name: /^Morning routine/ });
  await expect(morning).toContainText(/5 steps/);
  await morning.click();
  await expect(morning).toHaveAttribute("aria-pressed", "false");
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();

  const { data: hh } = await admin.from("households").select("id").eq("name", "Steps family").order("created_at", { ascending: false }).limit(1).single();
  householdId = hh!.id;
  const { data: nora } = await admin.from("kids").select("id").eq("household_id", householdId).single();
  noraId = nora!.id;

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  parent = await phone.newPage();
  await parent.goto("/login");
  await parent.getByLabel("Email").fill(email);
  await parent.getByLabel("Password").fill(password);
  await parent.getByRole("button", { name: "Log in" }).click();
  await expect(parent).toHaveURL(/\/admin/, { timeout: 45_000 });
});

test("parent builds a 3-step checklist and adds the Morning routine template", async () => {
  await parent.goto("/admin/chores");
  await parent.getByRole("button", { name: "+ New chore" }).click();
  await parent.getByRole("button", { name: /Start from blank/ }).click();
  await parent.getByLabel("Title").fill("My daily routine");
  await parent.getByLabel("Price").fill("0.10");
  await parent.getByRole("button", { name: "Daily", exact: true }).click();
  for (const step of ["Make your bed", "Brush your teeth", "Read for 15 minutes"]) {
    await parent.getByRole("button", { name: "+ Add step" }).click();
    await parent.getByRole("textbox", { name: /^Step \d+$/ }).last().fill(step);
  }
  await expect(parent.getByText(/only pays when every step is done/)).toBeVisible();
  await expect(parent.getByLabel("Who can do it at a time?")).toBeDisabled();
  await parent.getByRole("button", { name: "Add chore", exact: true }).click();
  await expect(parent.getByText("🔁 Routine · 3 steps")).toBeVisible({ timeout: 30_000 });

  const { data: mine } = await admin.from("chores").select("scope, price_cents, subtasks, translations").eq("household_id", householdId).eq("title", "My daily routine").single();
  expect(mine!.scope).toBe("per_kid");
  expect(mine!.price_cents).toBe(10);
  expect((mine!.subtasks as { title: string }[]).map((s) => s.title)).toEqual(["Make your bed", "Brush your teeth", "Read for 15 minutes"]);

  await parent.getByRole("button", { name: "📋 Add from templates" }).click();
  const pick = parent.getByRole("button", { name: /^Morning routine/ });
  await expect(pick).toContainText(/5 steps/);
  await pick.click();
  await expect(pick).toHaveAttribute("aria-pressed", "true");
  await parent.getByRole("button", { name: "Add selected" }).click();
  await expect
    .poll(async () => (await admin.from("chores").select("id").eq("household_id", householdId).eq("template_key", "morning_routine")).data?.length, { timeout: 30_000 })
    .toBe(1);
  await expect(parent.getByRole("button", { name: "Add selected" })).toHaveCount(0);
  await expect(parent.getByText("🔁 Routine · 5 steps")).toBeVisible({ timeout: 20_000 });
  const { data: am } = await admin.from("chores").select("subtasks, translations, price_cents, repeat_kind").eq("household_id", householdId).eq("template_key", "morning_routine").single();
  expect(am!.price_cents).toBe(10);
  expect(am!.repeat_kind).toBe("daily");
  expect((am!.subtasks as unknown[]).length).toBe(5);
  const tr = am!.translations as Record<string, { subtasks?: { title: string }[] }>;
  expect(tr.fr?.subtasks?.[0]?.title).toBe("Brosse-toi les dents");
  expect(tr.es?.subtasks?.length).toBe(5);
  expect(tr.pt?.subtasks?.length).toBe(5);
});

test("kid ticks 2 of 3: can't submit; ticks the 3rd: submits", async () => {
  await openBoard();
  await expect(card("My daily routine")).toContainText("0/3 steps");
  await card("My daily routine").click();
  const sheet = kid.getByRole("dialog", { name: "My daily routine" });
  const didIt = sheet.getByRole("button", { name: /I did it/ });
  await expect(didIt).toBeDisabled();
  await sheet.getByRole("checkbox", { name: "Make your bed" }).click();
  await expect(sheet.getByText("2 more to go!")).toBeVisible();
  await sheet.getByRole("checkbox", { name: "Brush your teeth" }).click();
  await expect(sheet.getByRole("checkbox", { name: "Brush your teeth" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByText("1 more to go!")).toBeVisible();
  await expect(didIt).toBeDisabled();
  await sheet.getByRole("button", { name: "Oops, not yet" }).click();

  // Progress is saved on the server (another tablet would see it too).
  await expect(card("My daily routine")).toContainText("2/3 steps", { timeout: 10_000 });
  // And the server refuses a submit that skips the UI.
  const { data: chore } = await admin.from("chores").select("id").eq("household_id", householdId).eq("title", "My daily routine").single();
  const forced = await kid.evaluate(
    async ({ kidId, choreId }) => {
      const res = await fetch("/api/kiosk/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidId, choreId, quantity: 1, idempotencyKey: crypto.randomUUID(), expectedLastId: null }),
      });
      return { status: res.status, body: await res.json() };
    },
    { kidId: noraId, choreId: chore!.id },
  );
  expect(forced).toEqual({ status: 400, body: { ok: false, reason: "incomplete" } });

  await card("My daily routine").click();
  await expect(sheet.getByRole("checkbox", { name: "Make your bed" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("checkbox", { name: "Read for 15 minutes" }).click();
  await expect(sheet.getByText("Every step done! 🎉")).toBeVisible();
  await expect(didIt).toBeEnabled();
  await didIt.click();
  await expect(kid.getByText("Sent to Mom/Dad for checking!")).toBeVisible();
});

test("sectioned Daily routine and the Morning routine show their steps", async () => {
  await card("Daily routine").click();
  const sheet = kid.getByRole("dialog", { name: "Daily routine" });
  for (const heading of ["🌅 Morning", "☀️ Afternoon", "🌙 Evening"]) {
    await expect(sheet.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(sheet.getByRole("checkbox")).toHaveCount(14);
  await expect(sheet.getByText("☑ 0/14 steps")).toBeVisible();
  await sheet.getByRole("checkbox", { name: "Nap time" }).click();
  await expect(sheet.getByText("13 more to go!")).toBeVisible();
  await expect(sheet.getByRole("button", { name: /I did it/ })).toBeDisabled();
  await sheet.getByRole("button", { name: "Oops, not yet" }).click();

  await card("Morning routine").click();
  const am = kid.getByRole("dialog", { name: "Morning routine" });
  await expect(am.getByRole("checkbox")).toHaveCount(5);
  for (const step of ["Brush your teeth", "Eat your breakfast", "Pack your backpack", "Clean your table", "Get ready for school"]) {
    await expect(am.getByRole("checkbox", { name: step })).toBeVisible();
  }
  await am.getByRole("button", { name: "Oops, not yet" }).click();
});

test("parent sees the steps and approves: +$0.10", async () => {
  await parent.goto("/admin/approvals");
  const steps = parent.getByTestId("approval-steps");
  await expect(steps).toContainText("All 3 steps done");
  await expect(steps).toContainText("Read for 15 minutes");
  await parent.getByRole("button", { name: /Approve/ }).first().click();
  await expect(parent.getByText("All caught up!")).toBeVisible();
  await expect
    .poll(async () => (await admin.from("kid_balances").select("balance_cents").eq("kid_id", noraId).single()).data?.balance_cents)
    .toBe(10);
});

test("next day: the checklist is back and every step starts fresh", async () => {
  await openBoard();
  await expect(card("My daily routine")).toHaveCount(0);

  // Time travel one day: submissions, chores and yesterday's ticks move back.
  const ms = 86_400_000;
  const { data: subs } = await admin.from("submissions").select("id, submitted_at, reviewed_at").eq("household_id", householdId);
  for (const s of subs ?? []) {
    await admin
      .from("submissions")
      .update({
        submitted_at: new Date(new Date(s.submitted_at).getTime() - ms).toISOString(),
        reviewed_at: s.reviewed_at ? new Date(new Date(s.reviewed_at).getTime() - ms).toISOString() : null,
      })
      .eq("id", s.id);
  }
  const { data: chores } = await admin.from("chores").select("id, created_at").eq("household_id", householdId);
  for (const c of chores ?? []) {
    await admin.from("chores").update({ created_at: new Date(new Date(c.created_at).getTime() - ms).toISOString() }).eq("id", c.id);
  }
  const { data: checks } = await admin.from("chore_subtask_checks").select("chore_id, subtask_id, period_key").eq("household_id", householdId);
  expect(checks?.length).toBeGreaterThan(0);
  for (const c of checks ?? []) {
    const d = new Date(`${c.period_key}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    await admin
      .from("chore_subtask_checks")
      .update({ period_key: d.toISOString().slice(0, 10) })
      .eq("kid_id", noraId)
      .eq("chore_id", c.chore_id)
      .eq("subtask_id", c.subtask_id);
  }

  await openBoard();
  await expect(card("My daily routine")).toContainText("0/3 steps");
  await expect(card("Daily routine")).toContainText("0/14 steps");
  await card("My daily routine").click();
  const sheet = kid.getByRole("dialog", { name: "My daily routine" });
  await expect(sheet.getByRole("checkbox", { name: "Make your bed" })).toHaveAttribute("aria-checked", "false");
  await expect(sheet.getByRole("button", { name: /I did it/ })).toBeDisabled();
});

test("routines have their own section and look, apart from regular chores", async () => {
  await openBoard();
  const routines = kid.locator("section", { has: kid.getByRole("heading", { name: /My routines/ }) });
  await expect(routines).toBeVisible();
  await expect(routines.getByRole("button", { name: /Daily routine/ })).toBeVisible();
  await expect(routines.getByText(/🔁 Routine/).first()).toBeVisible();
  // Regular chores are not in the routines section, and routines aren't mixed into the others.
  await expect(routines.getByRole("button", { name: /Garbage boss/ })).toHaveCount(0);
  const others = kid.locator("section", { hasNot: kid.getByRole("heading", { name: /My routines/ }) });
  await expect(others.getByRole("button", { name: /Daily routine/ })).toHaveCount(0);
  await kid.screenshot({ path: "/tmp/claude-501/shots/routines-board.png", fullPage: false });
});
