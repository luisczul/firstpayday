import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../scripts/load-env";

loadEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// The native apps' API (docs/native/app-api.md), end to end against the real server.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const email = `app-${randomUUID().slice(0, 8)}@example.test`;
const password = `app-${randomUUID()}`;
let accessToken = "";
let refreshToken = "";
let householdId = "";
let kidId = "";
let choreId = "";
const subIds: string[] = [];

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

async function pending(request: APIRequestContext, title: string, cents: number) {
  const { data, error } = await admin
    .from("submissions")
    .insert({ household_id: householdId, chore_id: choreId, kid_id: kidId, unit_price_cents: cents, amount_cents: cents, chore_title_snapshot: title, status: "pending" })
    .select("id")
    .single();
  expect(error).toBeNull();
  subIds.push(data!.id);
  return data!.id as string;
}

test("sign up, log in, refresh, and the errors speak the app's language", async ({ request }) => {
  // Terms must be accepted; passwords need 8 characters (French messages with Accept-Language: fr).
  let r = await request.post("/api/app/v1/auth/signup", { data: { email, password }, headers: { "accept-language": "fr" } });
  expect(r.status()).toBe(400);
  expect((await r.json()).error.message).toMatch(/accepter les conditions/);
  r = await request.post("/api/app/v1/auth/signup", { data: { email, password: "short", acceptedTerms: true } });
  expect((await r.json()).error.message).toBe("Use at least 8 characters.");

  r = await request.post("/api/app/v1/auth/signup", { data: { email, password, acceptedTerms: true, locale: "en" } });
  expect(r.status()).toBe(200);
  const signup = await r.json();
  // Local Supabase doesn't ask for email confirmation: the app is signed in right away.
  expect(signup.needsConfirmation).toBe(false);
  expect(signup.session.user.email).toBe(email);

  r = await request.post("/api/app/v1/auth/signup", { data: { email, password, acceptedTerms: true } });
  expect(r.status()).toBe(409);
  expect((await r.json()).error.code).toBe("conflict");

  r = await request.post("/api/app/v1/auth/login", { data: { email, password: "wrong-password" }, headers: { "accept-language": "es-MX" } });
  expect(r.status()).toBe(401);
  expect(await r.json()).toEqual({ error: { code: "invalid_credentials", message: "Ese correo y esa contraseña no coinciden." } });

  r = await request.post("/api/app/v1/auth/login", { data: { email, password } });
  expect(r.status()).toBe(200);
  const s = await r.json();
  expect(s).toMatchObject({ user: { email } });
  expect(typeof s.accessToken).toBe("string");
  expect(s.expiresAt).toBeGreaterThan(Date.now() / 1000);
  refreshToken = s.refreshToken;

  r = await request.post("/api/app/v1/auth/refresh", { data: { refreshToken } });
  expect(r.status()).toBe(200);
  const refreshed = await r.json();
  accessToken = refreshed.accessToken;
  refreshToken = refreshed.refreshToken;
  expect((await request.post("/api/app/v1/auth/refresh", { data: { refreshToken: "nope" } })).status()).toBe(401);

  // No token, or a bad one → 401.
  expect((await request.get("/api/app/v1/me")).status()).toBe(401);
  expect((await request.get("/api/app/v1/me", { headers: { Authorization: "Bearer nope" } })).status()).toBe(401);
});

test("me before and after onboarding (onboarding happens in the web view)", async ({ request, browser }) => {
  let r = await request.get("/api/app/v1/me", { headers: auth() });
  expect(await r.json()).toMatchObject({ user: { email }, household: null, pendingCount: 0, platformAdmin: false });
  expect((await request.get("/api/app/v1/approvals", { headers: auth() })).status()).toBe(403);

  // The web view signs itself in with the app's token and lands on /onboarding.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone) FirstPaydayApp/1.0 (iOS)" });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.evaluate(
    ({ token }) => {
      const f = document.createElement("form");
      f.method = "POST";
      f.action = "/api/app/v1/web-session";
      for (const [k, v] of Object.entries({ access_token: token, next: "/onboarding" })) {
        const i = document.createElement("input");
        i.name = k;
        i.value = v;
        f.appendChild(i);
      }
      document.body.appendChild(f);
      f.submit();
    },
    { token: accessToken },
  );
  await page.getByLabel("Home name").fill("App family");
  await page.getByRole("button", { name: /add your kids/ }).click();
  await page.getByLabel("Kid 1 name").fill("Nora");
  await page.getByRole("button", { name: /pick chores/ }).click();
  await expect(page.getByRole("button", { name: /the tablet/ })).toBeVisible({ timeout: 30_000 });

  // Inside the app, the admin has no web menus, install button or log-out (the app owns those).
  await page.goto("/admin/chores");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Download app" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  await ctx.close();

  r = await request.get("/api/app/v1/me", { headers: auth() });
  const me = await r.json();
  expect(me.household).toMatchObject({ name: "App family", currency: expect.any(String), locale: "en" });
  expect(me.access).toBe("full");
  householdId = me.household.id;
  const { data: kid } = await admin.from("kids").select("id").eq("household_id", householdId).eq("name", "Nora").single();
  kidId = kid!.id;
  const { data: chore } = await admin.from("chores").insert({ household_id: householdId, title: "Clean two bins", emoji: "🗑️", price_cents: 100, repeat_kind: "once" }).select("id").single();
  choreId = chore!.id;
});

test("approvals: list, approve with a tip, send back with a comment", async ({ request }) => {
  const a = await pending(request, "Clean two bins", 100);
  const b = await pending(request, "Clean two bins", 100);
  const c = await pending(request, "Clean two bins", 100);

  let r = await request.get("/api/app/v1/approvals", { headers: auth() });
  const list = await r.json();
  expect(list.items).toHaveLength(3);
  expect(list.items[0]).toMatchObject({
    id: a,
    kid: { id: kidId, name: "Nora" },
    chore: { id: choreId, title: "Clean two bins", emoji: "🗑️" },
    quantity: 1,
    amountCents: 100,
    resubmitted: false,
    kidNote: null,
    photoUrl: null,
  });
  expect((await (await request.get("/api/app/v1/me", { headers: auth() })).json()).pendingCount).toBe(3);

  // The chore's current name follows the chore (not the saved snapshot).
  await admin.from("chores").update({ title: "Wash the bins" }).eq("id", choreId);
  r = await request.get("/api/app/v1/approvals", { headers: auth() });
  expect((await r.json()).items[0].chore.title).toBe("Wash the bins");

  r = await request.post(`/api/app/v1/approvals/${a}/approve`, { headers: auth(), data: { bonusCents: 50 } });
  expect(await r.json()).toEqual({ ok: true });
  // Approving twice (a retried request) is harmless: no double payment.
  r = await request.post(`/api/app/v1/approvals/${a}/approve`, { headers: auth(), data: {} });
  expect(r.status()).toBe(200);
  r = await request.post(`/api/app/v1/approvals/${b}/approve`, { headers: auth(), data: { bonusCents: 999_999 } });
  expect(r.status()).toBe(400);

  r = await request.post(`/api/app/v1/approvals/${b}/send-back`, { headers: auth(), data: { comment: "  " } });
  expect(r.status()).toBe(400);
  r = await request.post(`/api/app/v1/approvals/${b}/send-back`, { headers: auth(), data: { comment: "The lid is still dirty" } });
  expect(await r.json()).toEqual({ ok: true });
  // Already rejected → 409 conflict (a sent-back chore can still be approved, like on the web).
  const d = await pending(request, "Clean two bins", 100);
  await admin.from("submissions").update({ status: "rejected" }).eq("id", d);
  r = await request.post(`/api/app/v1/approvals/${d}/approve`, { headers: auth(), data: {} });
  expect(r.status()).toBe(409);
  expect((await r.json()).error.code).toBe("conflict");

  expect((await request.post(`/api/app/v1/approvals/not-a-uuid/approve`, { headers: auth(), data: {} })).status()).toBe(404);

  const { data: rows } = await admin.from("submissions").select("id, status, review_comment").in("id", [a, b, c]);
  const byId = new Map(rows!.map((x) => [x.id, x]));
  expect(byId.get(a)!.status).toBe("approved");
  expect(byId.get(b)).toMatchObject({ status: "sent_back", review_comment: "The lid is still dirty" });
  expect(byId.get(c)!.status).toBe("pending");

  // Kids: balance = $1 + $0.50 tip, $1 still waiting.
  r = await request.get("/api/app/v1/kids", { headers: auth() });
  const kids = await r.json();
  expect(kids.items).toEqual([expect.objectContaining({ id: kidId, name: "Nora", balanceCents: 150, pendingCents: 100 })]);
});

test("another family's token can't see or touch these chores", async ({ request }) => {
  const otherEmail = `app2-${randomUUID().slice(0, 8)}@example.test`;
  const r0 = await request.post("/api/app/v1/auth/signup", { data: { email: otherEmail, password, acceptedTerms: true } });
  const other = (await r0.json()).session.accessToken as string;
  const c = subIds[2]!; // still pending
  const r = await request.post(`/api/app/v1/approvals/${c}/approve`, { headers: { Authorization: `Bearer ${other}` }, data: {} });
  expect(r.status()).toBe(403); // no household yet
  // With a home of their own: still can't see or approve this family's chores.
  const as = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${other}` } },
  });
  expect((await as.rpc("create_household", { p_name: "Other family", p_timezone: "America/Toronto", p_currency: "CAD", p_locale: "en" })).error).toBeNull();
  const list = await (await request.get("/api/app/v1/approvals", { headers: { Authorization: `Bearer ${other}` } })).json();
  expect(list.items).toEqual([]);
  const r2 = await request.post(`/api/app/v1/approvals/${c}/approve`, { headers: { Authorization: `Bearer ${other}` }, data: {} });
  expect(r2.status()).toBe(404);
  const { data } = await admin.from("submissions").select("status").eq("id", c).single();
  expect(data!.status).toBe("pending");
});

test("push tokens: register (idempotent), forget, and forgotten at log-out", async ({ request }) => {
  const token = `tok-${randomUUID()}`;
  expect((await request.post("/api/app/v1/push-tokens", { headers: auth(), data: { token, platform: "ios", locale: "fr" } })).status()).toBe(204);
  expect((await request.post("/api/app/v1/push-tokens", { headers: auth(), data: { token, platform: "ios", locale: "fr" } })).status()).toBe(204);
  expect((await request.post("/api/app/v1/push-tokens", { headers: auth(), data: { token, platform: "windows" } })).status()).toBe(400);
  const { data } = await admin.from("push_tokens").select("platform, locale").eq("token", token);
  expect(data).toEqual([{ platform: "ios", locale: "fr" }]);
  const left = async () => (await admin.from("push_tokens").select("id").eq("token", token)).data;

  expect((await request.delete("/api/app/v1/push-tokens", { headers: auth(), data: { token } })).status()).toBe(204);
  expect(await left()).toEqual([]);

  // A kid sending a chore with a registered token (no APNs keys locally): the chore still goes through.
  await request.post("/api/app/v1/push-tokens", { headers: auth(), data: { token, platform: "android" } });
  expect((await request.post("/api/app/v1/auth/logout", { headers: auth(), data: { pushToken: token } })).status()).toBe(204);
  expect(await left()).toEqual([]);
  // The session is over: its refresh token no longer works.
  expect((await request.post("/api/app/v1/auth/refresh", { data: { refreshToken } })).status()).toBe(401);
});

test("web-session: refuses cross-site posts and bad tokens; kiosk mode turns the device into the kids' tablet", async ({ request, browser }) => {
  const cross = await request.post("/api/app/v1/web-session", { form: { access_token: "x" }, headers: { "sec-fetch-site": "cross-site" }, maxRedirects: 0 });
  expect(cross.status()).toBe(403);
  const bad = await request.post("/api/app/v1/web-session", { form: { access_token: "nope", next: "//evil.example" }, maxRedirects: 0 });
  expect(bad.status()).toBe(303);
  expect(bad.headers().location).toMatch(/\/login\?next=%2Fadmin$/);

  // Fresh login (the previous session was logged out).
  const s = await (await request.post("/api/app/v1/auth/login", { data: { email, password } })).json();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, userAgent: "Mozilla/5.0 (iPad) FirstPaydayApp/1.0 (iOS)" });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.evaluate(
    ({ token }) => {
      const f = document.createElement("form");
      f.method = "POST";
      f.action = "/api/app/v1/web-session";
      for (const [k, v] of Object.entries({ access_token: token, mode: "kiosk" })) {
        const i = document.createElement("input");
        i.name = k;
        i.value = v;
        f.appendChild(i);
      }
      document.body.appendChild(f);
      f.submit();
    },
    { token: s.accessToken },
  );
  await expect(page.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/kids$/);
  const { count } = await admin.from("devices").select("id", { count: "exact", head: true }).eq("household_id", householdId).is("revoked_at", null);
  expect(count).toBe(1);
  // The web view's parent session is gone (the tablet belongs to the kids now)…
  await page.goto("/admin/chores");
  await expect(page).toHaveURL(/\/login|\/kids/);
  // …but the app's own session is independent and still works.
  expect((await request.get("/api/app/v1/me", { headers: { Authorization: `Bearer ${s.accessToken}` } })).status()).toBe(200);
  await ctx.close();
});

test("delete my account: from the app (email must match) and from web Settings; a shared home stays with the co-parent", async ({ request, browser }) => {
  // App: a parent alone in their home.
  const soloEmail = `solo-${randomUUID().slice(0, 8)}@example.test`;
  const solo = (await (await request.post("/api/app/v1/auth/signup", { data: { email: soloEmail, password, acceptedTerms: true } })).json()).session;
  const as = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${solo.accessToken}` } },
  });
  const { data: soloHome } = await as.rpc("create_household", { p_name: "Solo home", p_timezone: "America/Toronto", p_currency: "CAD", p_locale: "en" });
  let r = await request.post("/api/app/v1/account/delete", { headers: { Authorization: `Bearer ${solo.accessToken}`, "accept-language": "fr" }, data: { confirmEmail: "wrong@example.test" } });
  expect(r.status()).toBe(400);
  expect((await r.json()).error.message).toBe("Ce n'est pas le courriel de ce compte.");
  r = await request.post("/api/app/v1/account/delete", { headers: { Authorization: `Bearer ${solo.accessToken}` }, data: { confirmEmail: soloEmail.toUpperCase() } });
  expect(r.status()).toBe(204);
  expect((await admin.from("households").select("id").eq("id", soloHome as string)).data).toEqual([]);
  expect((await request.post("/api/app/v1/auth/login", { data: { email: soloEmail, password } })).status()).toBe(401);

  // Web: the owner of a home shared with a co-parent deletes their account in Settings.
  const ownerEmail = `own-${randomUUID().slice(0, 8)}@example.test`;
  const coEmail = `co-${randomUUID().slice(0, 8)}@example.test`;
  const owner = (await (await request.post("/api/app/v1/auth/signup", { data: { email: ownerEmail, password, acceptedTerms: true } })).json()).session;
  const co = (await (await request.post("/api/app/v1/auth/signup", { data: { email: coEmail, password, acceptedTerms: true } })).json()).session;
  const asOwner = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${owner.accessToken}` } },
  });
  const { data: sharedHome } = await asOwner.rpc("create_household", { p_name: "Shared home", p_timezone: "America/Toronto", p_currency: "CAD", p_locale: "en" });
  await admin.from("household_members").insert({ household_id: sharedHome as string, user_id: co.user.id, role: "parent" });

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 45_000 });
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Delete my account" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("“Shared home” stays with the other parent.")).toBeVisible();
  const del = page.getByRole("button", { name: "Delete my account" });
  await expect(del).toBeDisabled();
  await page.getByLabel(`Type your email (${ownerEmail}) to confirm`).fill(ownerEmail);
  await del.click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await ctx.close();

  expect((await admin.from("households").select("name").eq("id", sharedHome as string)).data).toEqual([{ name: "Shared home" }]);
  expect((await admin.from("household_members").select("user_id, role").eq("household_id", sharedHome as string)).data).toEqual([{ user_id: co.user.id, role: "owner" }]);
  expect((await request.post("/api/app/v1/auth/login", { data: { email: ownerEmail, password } })).status()).toBe(401);
});
