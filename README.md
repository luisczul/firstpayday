# Chore Board

Kid-friendly chore and allowance web app: a shared kitchen tablet in Kids Mode, a parent approval queue, a money ledger per kid, and Stripe subscriptions. Deploys to `kids.diegoczul.com`.

The full product and build brief is in [SPEC.md](SPEC.md). Build phases are in §14.

## Status

Phase 0: spec committed. Scaffolding starts with Phase 1 (Foundation).

## Local setup (once scaffolded)

```bash
pnpm i
cp .env.example .env.local   # then fill in values
supabase start
pnpm dev
```

## Secrets

Real values live only in `.env.local` (gitignored) and in Vercel env vars. Before every push:

```bash
git grep -nE "sk_(live|test)_|whsec_|service_role" -- ':!SPEC.md' ':!.env.example'
```

must return nothing.
