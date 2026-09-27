/**
 * The full First Payday story, as one family lives it (local stack only):
 * sign up → 3 kids → chores → tablet → kids earn → parent reviews on a phone
 * → PIN unlock → custom per-unit chore → payout → THREE WEEKS LATER (time
 * travel in the DB) → trial over, board read-only → subscribe with a Stripe
 * test card → quantity follows kids → portal → revoke tablet.
 *
 * Needs: pnpm db:start, Stripe test keys + `stripe listen` forwarding to
 * localhost:3000, and the dev server on :3000 (reuseExistingServer).
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
if (!process.env.NEXT_PUBLIC_SUPABASE_URL!.includes("127.0.0.1")) throw new Error("Local stack only.");

const email = `family-${randomUUID().slice(0, 8)}@example.test`;
const password = `fp-${randomUUID()}`;
const PIN = "4826";
let householdId = "";
const kidId: Record<string, string> = {};

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let tablet: BrowserContext;
let kid: Page;
let parentCtx: BrowserContext;
let parent: Page;

async function openBoard(name: string) {
  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: new RegExp(name) }).click();
  await expect(kid.getByRole("heading", { name })).toBeVisible();
}

async function doChore(title: string, opts: { more?: number } = {}) {
  await kid.getByRole("button", { name: title, exact: true }).first().click();
  for (let i = 0; i < (opts.more ?? 0); i++) await kid.getByRole("button", { name: "More" }).click();
  await kid.getByRole("button", { name: /I did it/ }).click();
  await expect(kid.getByText("Sent to Mom/Dad for checking!")).toBeVisible();
}

async function phoneLogin(browser: Browser) {
  parentCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  parent = await parentCtx.newPage();
  await parent.goto("/login");
  await parent.getByLabel("Email").fill(email);
  await parent.getByLabel("Password").fill(password);
  await parent.getByRole("button", { name: "Log in" }).click();
  await expect(parent).toHaveURL(/\/admin\/approvals/, { timeout: 45_000 });
}

async function shiftTime(days: number) {
  // Everything that happened moves `days` into the past.
  const ms = days * 86_400_000;
  const { data: subs } = await admin.from("submissions").select("id, submitted_at").eq("household_id", householdId);
  for (const s of subs ?? []) {
    await admin.from("submissions").update({ submitted_at: new Date(new Date(s.submitted_at).getTime() - ms).toISOString() }).eq("id", s.id);
  }
  const { data: chores } = await admin.from("chores").select("id, created_at").eq("household_id", householdId);
  for (const c of chores ?? []) {
    await admin.from("chores").update({ created_at: new Date(new Date(c.created_at).getTime() - ms).toISOString() }).eq("id", c.id);
  }
  const { data: kidsRows } = await admin.from("kids").select("id, last_seen_board_at").eq("household_id", householdId);
  for (const k of kidsRows ?? []) {
    if (k.last_seen_board_at) {
      await admin.from("kids").update({ last_seen_board_at: new Date(new Date(k.last_seen_board_at).getTime() - ms).toISOString() }).eq("id", k.id);
    }
  }
  const { data: sub } = await admin.from("subscriptions").select("trial_ends_at").eq("household_id", householdId).single();
  await admin
    .from("subscriptions")
    .update({ trial_ends_at: new Date(new Date(sub!.trial_ends_at!).getTime() - ms).toISOString() })
    .eq("household_id", householdId);
}

test("1. sign up and set up a 3-kid home in under a minute", async ({ browser }) => {
  tablet = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  kid = await tablet.newPage();
  const t0 = Date.now();
  await kid.goto("/");
  await kid.getByRole("link", { name: "Start free" }).first().click();
  await kid.getByLabel("Email").fill(email);
  await kid.getByLabel("Password").fill(password);
  await kid.getByRole("checkbox").check();
  await kid.getByRole("button", { name: "Create my account" }).click();

  await kid.getByLabel("Home name").fill("Test family");
  await kid.getByLabel("Currency").selectOption("CAD");
  await kid.getByRole("button", { name: /add your kids/ }).click();

  await kid.getByLabel("Kid 1 name").fill("Mateo");
  await kid.getByRole("button", { name: "+ Add another" }).click();
  await kid.getByLabel("Kid 2 name").fill("Sofia");
  await kid.getByRole("button", { name: "+ Add another" }).click();
  await kid.getByLabel("Kid 3 name").fill("Lucas");
  await kid.getByRole("button", { name: /pick chores/ }).click();

  await expect(kid.getByText("20 chores selected")).toBeVisible();
  await kid.getByRole("button", { name: /the tablet/ }).click();
  await kid.getByRole("button", { name: /Use this device as the kids/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();
  for (const n of ["Mateo", "Sofia", "Lucas"]) await expect(kid.getByRole("button", { name: new RegExp(n) })).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(60_000);

  const { data: u } = await admin.from("households").select("id").eq("name", "Test family").order("created_at", { ascending: false }).limit(1).single();
  householdId = u!.id;
  const { data: kidsRows } = await admin.from("kids").select("id, name").eq("household_id", householdId);
  for (const k of kidsRows ?? []) kidId[k.name] = k.id;
  const { data: sub } = await admin.from("subscriptions").select("plan, status").eq("household_id", householdId).single();
  expect(sub).toEqual({ plan: "trial", status: "trialing" });
});

test("2. kids earn: 2 of 3 floors, whole-house vs each-kid chores, no typing", async () => {
  await openBoard("Mateo");
  await expect(kid.locator("textarea, input:not([type=search])")).toHaveCount(0);
  await doChore("Baseboards", { more: 1 }); // 2 floors
  await expect(kid.getByRole("button", { name: "My money" })).toContainText("$4.00 waiting for check"); // Baseboards: $2 per floor × 2
  await doChore("Sous-chef night");

  await openBoard("Sofia");
  // Whole-house chore Mateo took is gone for Sofia; the per-kid one is still hers to do.
  await expect(kid.getByRole("button", { name: "Baseboards", exact: true })).toHaveCount(0);
  await expect(kid.getByRole("button", { name: "Sous-chef night", exact: true })).toHaveCount(1);
  await doChore("Sous-chef night");
  await doChore("Garbage boss");

  await openBoard("Lucas");
  await expect(kid.getByRole("button", { name: "Garbage boss", exact: true })).toHaveCount(0);
  await doChore("Entryway shoe station");
});

test("3. parent on a phone: edit quantity, send back, reject, approve", async ({ browser }) => {
  await phoneLogin(browser);
  await expect(parent.getByText("5 waiting for your check")).toBeVisible();

  // Mateo said 2 floors; parent approves 1.
  // Pending items only ("Recently approved" also lists chores by name).
  const baseboards = parent.locator("li", { hasText: "Baseboards" }).filter({ hasNot: parent.getByRole("button", { name: "Undo…" }) });
  await baseboards.getByRole("button", { name: "Less" }).click();
  await expect(baseboards.getByText("$2.00", { exact: true })).toBeVisible();
  await baseboards.getByRole("button", { name: /Approve/ }).click();
  await expect(baseboards).toHaveCount(0);

  const sousMateo = parent.locator("section", { hasText: "Mateo" }).locator("li", { hasText: "Sous-chef night" }).filter({ hasNot: parent.getByRole("button", { name: "Undo…" }) });
  await sousMateo.getByRole("button", { name: /Send back/ }).click();
  await sousMateo.getByRole("button", { name: "Not finished" }).click();
  await sousMateo.getByRole("button", { name: "Send back", exact: true }).click();
  await expect(sousMateo).toHaveCount(0);

  const shoes = parent.locator("li", { hasText: "Entryway shoe station" }).filter({ hasNot: parent.getByRole("button", { name: "Undo…" }) });
  await shoes.getByRole("button", { name: "More" }).click();
  await shoes.getByRole("button", { name: "Reject…" }).click();
  await shoes.getByPlaceholder("Type a message…").fill("Shoes are still everywhere");
  await shoes.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(shoes).toHaveCount(0);

  await parent.locator("section", { hasText: "Sofia" }).getByRole("button", { name: /Approve all/ }).click();
  await parent.getByRole("button", { name: "Yes, approve all" }).click();
  await expect(parent.getByText("All caught up!")).toBeVisible();

  const { data: bal } = await admin.from("kid_balances").select("kid_id, balance_cents").eq("household_id", householdId);
  const by = Object.fromEntries((bal ?? []).map((b) => [b.kid_id, b.balance_cents]));
  expect(by[kidId.Mateo!]).toBe(200); // 1 floor of Baseboards
  expect(by[kidId.Sofia!]).toBe(300); // Sous-chef $2 + Garbage boss $1
  expect(by[kidId.Lucas!]).toBe(0);
});

test("4. needs fixing → fixed it → approved; rejected once-weekly stays in cooldown", async () => {
  await openBoard("Mateo");
  await expect(kid.getByRole("heading", { name: /Needs fixing/ })).toBeVisible();
  await expect(kid.getByText("Not finished").first()).toBeVisible();
  await kid.locator("#needs-fixing").getByRole("button", { name: /Sous-chef night/ }).click();
  await kid.getByRole("button", { name: "Fixed it! 🔧", exact: true }).click();
  await expect(kid.locator("#needs-fixing")).toHaveCount(0);

  await parent.reload();
  await expect(parent.getByText("FIXED")).toBeVisible();
  await parent.getByRole("button", { name: /Approve/ }).first().click();
  await expect(parent.getByText("All caught up!")).toBeVisible();
  await expect(kid.getByRole("button", { name: "My money" })).toContainText("$4.00 in my bank", { timeout: 10_000 });

  await openBoard("Lucas");
  await expect(kid.getByText(/Coming back soon/)).toBeVisible();
  await expect(kid.getByRole("button", { name: "Entryway shoe station", exact: true })).toHaveCount(0);
});

test("5. custom per-unit chore, inline price, pause, payout", async () => {
  await parent.goto("/admin/chores");
  await parent.getByRole("button", { name: "+ New chore" }).click();
  await parent.getByRole("button", { name: /Start from blank/ }).click();
  await parent.getByLabel("Title").fill("Clean the windows");
  await parent.getByLabel("Description (what kids read)").fill("Inside and outside, no streaks.");
  await parent.getByLabel("Price").fill("3");
  await parent.getByRole("textbox", { name: "max quantity" }).fill("5");
  await parent.getByLabel("Unit label").fill("window");
  await parent.getByRole("button", { name: "Add chore", exact: true }).click();
  await expect(parent.getByText("Clean the windows")).toBeVisible();

  await openBoard("Lucas");
  await kid.getByRole("button", { name: "Clean the windows" }).click();
  await expect(kid.getByText("How many windows?")).toBeVisible();
  for (let i = 0; i < 3; i++) await kid.getByRole("button", { name: "More" }).click();
  await expect(kid.getByText("= $12.00")).toBeVisible();
  await kid.getByRole("button", { name: "Oops, not yet" }).click();

  // Pause Laundry: disappears for kids.
  const laundry = parent.locator("div", { has: parent.getByText("Laundry manager", { exact: true }) }).filter({ has: parent.getByRole("button", { name: /Pause/ }) }).last();
  await laundry.getByRole("button", { name: /Pause/ }).click();
  await openBoard("Lucas");
  await expect(kid.getByRole("button", { name: "Laundry manager", exact: true })).toHaveCount(0);

  await parent.goto("/admin/payouts?kid=" + kidId.Sofia);
  await parent.getByLabel("Amount").fill("2");
  await parent.getByRole("button", { name: "Record payout" }).click();
  await expect(parent.getByText("Paid $2.00 to Sofia")).toBeVisible();
  await openBoard("Sofia");
  await expect(kid.getByRole("button", { name: "My money" })).toContainText("$1.00 in my bank");
});

test("6. PIN unlock on the tablet, wrong PIN locks after 5 tries", async () => {
  await parent.goto("/admin/settings");
  await parent.getByPlaceholder("Mom, Dad, Cami…").fill("Dad");
  await parent.getByRole("button", { name: "Save", exact: true }).first().click();
  await parent.getByPlaceholder("••••").fill(PIN);
  await parent.getByRole("button", { name: "Set PIN" }).click();
  await expect(parent.getByText("PIN set")).toBeVisible();

  await kid.goto("/kids");
  await kid.waitForLoadState("networkidle");
  await kid.getByRole("button", { name: /Parent/ }).click();
  await expect(kid.getByText("Enter your PIN")).toBeVisible();
  for (const d of PIN) await kid.getByRole("button", { name: d, exact: true }).click();
  await kid.getByRole("button", { name: "✓" }).click();
  await expect(kid).toHaveURL(/\/admin\/approvals/);
  await expect(kid.getByRole("button", { name: /Back to Kids Mode/ })).toBeVisible();
  await kid.getByRole("button", { name: /Back to Kids Mode/ }).click();
  await expect(kid.getByRole("heading", { name: "Who's here?" })).toBeVisible();
  await kid.waitForLoadState("networkidle");

  await kid.getByRole("button", { name: /Parent/ }).click();
  await expect(kid.getByText("Enter your PIN")).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const d of "1111") await kid.getByRole("button", { name: d, exact: true }).click();
    await kid.getByRole("button", { name: "✓" }).click();
    await expect(kid.getByRole("alert")).toBeVisible();
  }
  await expect(kid.getByText(/Too many tries/)).toBeVisible();
  await kid.getByRole("button", { name: "Cancel" }).click();
  await admin.from("household_members").update({ pin_locked_until: null, pin_failed_attempts: 0 }).eq("household_id", householdId);
});

test("7. THREE WEEKS LATER: chores come back, trial over, 3 kids → read-only", async () => {
  await shiftTime(21);

  await openBoard("Mateo");
  // Baseboards (every 14 days) is back and flagged New; weekly chores are back too.
  await expect(kid.getByRole("heading", { name: /New!/ })).toBeVisible();
  await expect(kid.getByRole("button", { name: "Baseboards", exact: true })).toHaveCount(1);
  await expect(kid.getByRole("button", { name: "Sous-chef night", exact: true })).toHaveCount(1);
  if (process.env.BILLING_ENABLED !== "true") {
    // Billing is switched off for now: 3 kids, trial long over, still fully usable.
    await kid.getByRole("button", { name: "Baseboards", exact: true }).click();
    await expect(kid.getByRole("dialog")).toBeVisible();
    await parent.goto("/admin/approvals");
    await expect(parent.getByText(/read-only/)).toHaveCount(0);
    // Billing is hidden while free: its page sends parents back to Settings.
    await parent.goto("/admin/settings/billing");
    await expect(parent).toHaveURL(/\/admin\/settings$/);
  } else {
    // Trial ended a week ago with 3 kids and no subscription → paused board.
    await expect(kid.getByText("The chore board is paused. Ask a parent!").first()).toBeVisible();
    await kid.getByRole("button", { name: "Baseboards", exact: true }).click();
    await expect(kid.getByRole("dialog")).toHaveCount(0);
    await parent.goto("/admin/approvals");
    await expect(parent.getByText(/read-only/).first()).toBeVisible();
    await parent.goto("/admin/settings/billing");
    await expect(parent.getByText(/3 kids but no active subscription/)).toBeVisible();
    await expect(parent.getByRole("button", { name: /Subscribe: \$10\.00\/month/ })).toBeVisible();
  }
  // History and CSV are always available.
  const csv = await parent.request.get("/admin/history/export");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Baseboards");
});

test("8. archive down to one kid → free; restore needs a subscription", async () => {
  test.skip(process.env.BILLING_ENABLED !== "true", "billing is switched off for now");
  await parent.goto(`/admin/kids/${kidId.Lucas}`);
  await parent.getByRole("button", { name: "Archive" }).click();
  await expect(parent.getByRole("button", { name: "Restore" })).toBeVisible();
  await parent.goto(`/admin/kids/${kidId.Sofia}`);
  await parent.getByRole("button", { name: "Archive" }).click();
  await expect(parent.getByRole("button", { name: "Restore" })).toBeVisible();
  await parent.goto("/admin/approvals");
  await expect(parent.getByText(/read-only/)).toHaveCount(0);

  await parent.goto(`/admin/kids/${kidId.Sofia}`);
  await parent.getByRole("button", { name: "Restore" }).click();
  await expect(parent.getByText(/Each extra kid is \$5\/month/)).toBeVisible();
});

test("9. subscribe with a Stripe test card; quantity follows kids", async () => {
  test.skip(!process.env.STRIPE_SECRET_KEY || process.env.BILLING_ENABLED !== "true", "needs Stripe test keys and billing switched on");
  // Bring the 3 kids back through the service role (as if restored earlier).
  await admin.from("kids").update({ archived_at: null }).eq("household_id", householdId);
  await parent.goto("/admin/settings/billing");
  await parent.getByRole("button", { name: /Subscribe: \$10\.00\/month/ }).click();
  await parent.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

  // Stripe test card (published test number; test mode only).
  await parent.locator("#payment-method-accordion-item-title-card").check({ force: true });
  await parent.locator("#cardNumber").fill("4242 4242 4242 4242");
  await parent.locator("#cardExpiry").fill("12 / 34");
  await parent.locator("#cardCvc").fill("123");
  await parent.locator("#billingName").fill("Test Parent");
  await parent.locator("#billingCountry").selectOption("CA");
  await parent.locator("#billingAddressLine1").fill("123 Rue Test");
  await parent.locator("#billingLocality").fill("Montreal");
  await parent.locator("#billingAdministrativeArea").selectOption("QC");
  await parent.locator("#billingPostalCode").fill("H2X 1Y4");
  const save = parent.locator("#enableStripePass");
  if (await save.isChecked()) await save.uncheck();
  await parent.getByRole("button", { name: "Subscribe" }).click();
  await parent.waitForURL(/\/admin\/settings\/billing\?success=1/, { timeout: 60_000 });

  // The webhook (stripe listen) flips access within seconds.
  await expect
    .poll(async () => (await admin.from("subscriptions").select("status, quantity, plan").eq("household_id", householdId).single()).data, { timeout: 30_000 })
    .toMatchObject({ status: "active", quantity: 2, plan: "family" });
  await parent.reload();
  await expect(parent.getByText("Family subscription")).toBeVisible();
  await openBoard("Lucas");
  await expect(kid.getByText("The chore board is paused. Ask a parent!")).toHaveCount(0);

  // Add a 4th kid → Stripe quantity 3.
  await parent.goto("/admin/kids");
  await parent.getByRole("button", { name: "+ Add kid" }).click();
  await parent.getByLabel("First name").fill("Emma");
  await parent.getByRole("button", { name: "Add kid", exact: true }).click();
  await expect(parent.getByText("Emma")).toBeVisible();
  await expect
    .poll(async () => (await admin.from("subscriptions").select("quantity").eq("household_id", householdId).single()).data?.quantity, { timeout: 30_000 })
    .toBe(3);

  // Customer Portal opens.
  await parent.goto("/admin/settings/billing");
  await parent.getByRole("button", { name: /Manage billing/ }).click();
  await parent.waitForURL(/billing\.stripe\.com/, { timeout: 30_000 });
});

test("10. revoke the tablet: it's disconnected immediately", async () => {
  await parent.goto("/admin/settings/devices");
  await parent.getByRole("button", { name: "Revoke" }).first().click();
  await parent.getByRole("button", { name: "Yes, disconnect" }).click();
  await kid.goto("/kids");
  await expect(kid.getByText(/This tablet was disconnected/)).toBeVisible();
});

test("11. public pages are complete and linked", async ({ page }) => {
  for (const [path, text] of [
    ["/", "pays your kids"],
    ["/terms", "Terms of Service"],
    ["/privacy", "Kids have no accounts"],
    ["/chore-chart-app", "chore chart app"],
    ["/allowance-app-for-kids", "allowance app"],
    ["/paid-chores-list", "Paid chores list"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByText(new RegExp(text, "i")).first()).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "info@firstpayday.app" })).toBeVisible();
  }
  const sitemap = await page.request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/paid-chores-list");
});
