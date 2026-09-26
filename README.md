# First Payday

Kid-friendly chore and allowance app. Pricing: first kid free, $5 CAD/month per extra kid. A kitchen tablet stays in **Kids Mode** (tap your face → tap a card → "I did it!"), parents approve from any phone or computer, and every kid has a money ledger. Public SaaS with Stripe subscriptions. Production: `firstpayday.app`.

The full product brief is [SPEC.md](SPEC.md).

## Stack

Next.js 15 (App Router) · Tailwind v4 · Supabase (Postgres, Auth, Storage, Realtime) · Stripe · Vercel · Vitest · Playwright.

## Run it locally

Needs Node 22+ (`.nvmrc`), pnpm, and Docker Desktop running.

```bash
pnpm i
pnpm db:start          # local Supabase in Docker: applies migrations + templates
cp .env.example .env.local
```

Fill `.env.local` with the values printed by `pnpm exec supabase status -o env`:
`NEXT_PUBLIC_SUPABASE_URL` = `API_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` = `SERVICE_ROLE_KEY`, and generate the two cookie secrets:

```bash
openssl rand -hex 32   # KIOSK_COOKIE_SECRET
openssl rand -hex 32   # ADMIN_MODE_SECRET
```

Leave `SUPABASE_DB_PASSWORD` out of `.env.local` for local work (an empty value confuses the Supabase CLI).

```bash
pnpm dev               # http://localhost:3000
```

Local helpers: Supabase Studio at http://127.0.0.1:54323, captured emails (magic links, resets) at http://127.0.0.1:54324.

Try it: sign up → name your home → add kids → pick chores → **Use this device as the kids' tablet**. Tap **Parent** (top-right on the kid picker) to get back into Admin.

## Tests

```bash
pnpm test              # unit: scheduling engine, money, billing rules (100% branch coverage)
pnpm test:coverage
pnpm test:rls          # RLS proofs against local Supabase (tenant isolation, append-only ledger…)
pnpm e2e               # Playwright, 3 main flows, uses your installed Google Chrome
pnpm typecheck && pnpm lint
```

## How it fits together

| Area | Where |
|---|---|
| Schema, RLS, SQL functions | `supabase/migrations/*.sql` |
| When a chore shows / hides / comes back | `lib/schedule/getChoreState.ts` (pure, fully tested) |
| Kid board sections | `lib/board/buildBoard.ts` |
| Kiosk (no-login tablet) API — the whitelist | `lib/kiosk/operations.ts`, `app/api/kiosk/*` |
| Parent session + write checks | `lib/auth/session.ts`, `app/actions/*` |
| Plans & limits (single source) | `lib/billing/plans.ts`, `lib/billing/access.ts` |
| Stripe | `lib/billing/stripe.ts`, `app/api/stripe/*`, `scripts/stripe-setup.ts` |
| Brand name / legal entity | `lib/brand.ts` |

Security model in one paragraph: parents use Supabase Auth and every table has RLS scoped by `is_member(household_id)`. The kids' tablet never has a user session: it holds an httpOnly `kiosk_token` cookie whose HMAC is stored in `devices`; kiosk routes resolve the household from that token and use the service role, always filtered by that household. Money only changes through append-only `ledger_entries` (a trigger blocks UPDATE/DELETE for everyone) and the `approve_submission()` function. Admin Mode on a kiosk tablet is a signed, sliding `admin_mode_until` cookie enforced in middleware.

## Deploy

### 1. Supabase (production)
1. Create a project in region **ca-central-1** (Canada). Save the DB password.
2. Link and push the schema:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push        # migrations incl. templates + avatars bucket
   ```
3. Auth → URL configuration: Site URL `https://firstpayday.app`; redirect URLs `https://firstpayday.app/**` and `http://localhost:3000/**`.
4. Auth → SMTP: point at Resend (or another SMTP) so confirmation and reset emails come from your domain.
5. Use a separate project (or Supabase branching) for Vercel Preview deployments.

### 2. Stripe (test mode first)
```bash
STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe-setup.ts
```
It creates/finds the $5/month extra-kid price by lookup key, prints `STRIPE_PRICE_EXTRA_KID_MONTHLY`, and prints the dashboard checklist (Stripe Tax for GST/HST + QST, Customer Portal, webhook endpoint `/api/stripe/webhook` with `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`). If Stripe Tax isn't on yet, set `STRIPE_AUTOMATIC_TAX=false`.

Local webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook` (put the printed `whsec_…` in `.env.local`). Test card `4242 4242 4242 4242`.

### 3. Vercel
1. Import the GitHub repo. Framework: Next.js. Node 22.
2. Env vars (Production and Preview separately), names in `.env.example`: Supabase URL/anon/service role, Stripe keys + webhook secret + price ids, (optional) `KIOSK_COOKIE_SECRET`, `ADMIN_MODE_SECRET`, `APP_URL=https://firstpayday.app`, `CRON_SECRET` (for the daily trial-email cron in `vercel.json`), optional `RESEND_API_KEY`, `EMAIL_FROM`, `LEGAL_ENTITY_NAME`.
3. Domains → add `firstpayday.app` and `www.firstpayday.app` (www redirects to the apex). At GoDaddy DNS: **A `@` → the IP Vercel shows** and **CNAME `www` → the value Vercel shows**.

Live Stripe keys go only into Vercel **Production** env vars, never into a file.

### 4. After the first deploy
1. Sign up at `https://firstpayday.app` like any customer.
2. Make yourself platform owner: `pnpm tsx scripts/make-platform-admin.ts you@example.com` (with production env loaded).
3. Open `/platform` → your household → **Set comp**.

## Secrets

Real values live only in `.env.local` (gitignored) and Vercel. Before every push:

```bash
pnpm secrets:check
```
