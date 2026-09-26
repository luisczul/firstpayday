-- Chore Board core schema (SPEC §4). Money is always integer cents.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  timezone text not null default 'America/Toronto',
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  locale text not null default 'en' check (locale in ('en','fr')),
  theme text not null default 'fall',
  admin_timeout_minutes int not null default 30 check (admin_timeout_minutes between 1 and 240),
  kid_idle_seconds int not null default 90 check (kid_idle_seconds between 15 and 900),
  savings_match_percent int not null default 0 check (savings_match_percent between 0 and 200),
  week_starts_on int not null default 1 check (week_starts_on between 0 and 6),
  last_activity_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','parent')),
  display_name text,
  pin_hash text,
  pin_failed_attempts int not null default 0,
  pin_locked_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_id_idx on public.household_members (user_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  role text not null default 'parent' check (role in ('owner','parent')),
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index household_invites_household_id_idx on public.household_invites (household_id);

-- ---------------------------------------------------------------------------
-- Kids and chores
-- ---------------------------------------------------------------------------

create table public.kids (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  avatar_path text,
  color text not null default '#E08A1E' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0,
  last_seen_board_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index kids_household_id_idx on public.kids (household_id, sort_order);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  template_key text,
  title text not null check (length(trim(title)) between 1 and 80),
  description text,
  emoji text,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  price_cents int not null check (price_cents >= 0 and price_cents <= 100000),
  unit_label text,
  max_quantity int not null default 1 check (max_quantity between 1 and 20),
  repeat_kind text not null check (repeat_kind in ('once','daily','weekly','every_n_days')),
  repeat_every_days int check (repeat_every_days is null or repeat_every_days between 1 and 365),
  scope text not null default 'household' check (scope in ('household','per_kid')),
  requires_approval boolean not null default true,
  note_for_kids text,
  available_from date,
  available_until date,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chores_every_n_days_requires_n
    check (repeat_kind <> 'every_n_days' or repeat_every_days is not null),
  constraint chores_window_order
    check (available_from is null or available_until is null or available_from <= available_until)
);
create index chores_household_id_idx on public.chores (household_id, sort_order);

create table public.chore_assignees (
  chore_id uuid not null references public.chores(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  primary key (chore_id, kid_id)
);
create index chore_assignees_kid_id_idx on public.chore_assignees (kid_id);
create index chore_assignees_household_id_idx on public.chore_assignees (household_id);

-- ---------------------------------------------------------------------------
-- Submissions and ledger
-- ---------------------------------------------------------------------------

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  chore_id uuid not null references public.chores(id) on delete no action,
  kid_id uuid not null references public.kids(id) on delete no action,
  quantity int not null default 1 check (quantity >= 1),
  unit_price_cents int not null check (unit_price_cents >= 0),
  amount_cents int not null check (amount_cents >= 0),
  chore_title_snapshot text not null,
  status text not null check (status in ('pending','approved','sent_back','rejected')),
  submitted_at timestamptz not null default now(),
  resubmitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_comment text,
  device_id uuid,
  idempotency_key text,
  photo_path text, -- reserved for v2 photo proof
  created_at timestamptz not null default now()
);
create index submissions_household_status_idx on public.submissions (household_id, status);
create index submissions_chore_kid_submitted_idx on public.submissions (chore_id, kid_id, submitted_at desc);
create index submissions_kid_id_idx on public.submissions (kid_id);
create unique index submissions_idempotency_idx
  on public.submissions (household_id, idempotency_key) where idempotency_key is not null;

create table public.submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  event text not null check (event in ('submitted','resubmitted','approved','sent_back','rejected')),
  comment text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index submission_events_submission_id_idx on public.submission_events (submission_id);
create index submission_events_household_id_idx on public.submission_events (household_id);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete no action,
  kind text not null check (kind in ('earning','payout','adjustment','match')),
  amount_cents int not null,
  submission_id uuid references public.submissions(id) on delete no action,
  method text check (method is null or method in ('cash','bank','savings','other')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ledger_sign check (
    (kind in ('earning','match') and amount_cents >= 0)
    or (kind = 'payout' and amount_cents <= 0)
    or kind = 'adjustment'
  )
);
create index ledger_entries_kid_id_idx on public.ledger_entries (kid_id);
create index ledger_entries_household_id_idx on public.ledger_entries (household_id, created_at desc);
-- One earning and at most one match per submission: makes approval idempotent.
create unique index ledger_entries_one_earning_per_submission
  on public.ledger_entries (submission_id, kind) where submission_id is not null;

-- ---------------------------------------------------------------------------
-- Devices (kiosk tablets)
-- ---------------------------------------------------------------------------

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null default 'Kitchen tablet',
  token_hash text not null unique,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index devices_household_id_idx on public.devices (household_id);

-- ---------------------------------------------------------------------------
-- Templates (global reference data)
-- ---------------------------------------------------------------------------

create table public.chore_templates (
  key text not null,
  locale text not null default 'en' check (locale in ('en','fr')),
  title text not null,
  description text,
  emoji text,
  price_cents int not null check (price_cents >= 0),
  unit_label text,
  max_quantity int not null default 1,
  repeat_kind text not null check (repeat_kind in ('once','daily','weekly','every_n_days')),
  repeat_every_days int,
  scope text not null default 'household' check (scope in ('household','per_kid')),
  season text,
  category text,
  sort_order int not null default 0,
  primary key (key, locale)
);

-- ---------------------------------------------------------------------------
-- Billing and platform (SPEC §19–20)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  household_id uuid primary key references public.households(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'trial' check (plan in ('trial','family','family_plus','comp','free')),
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  past_due_since timestamptz,
  updated_at timestamptz not null default now()
);

create table public.stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  household_id uuid references public.households(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_household_id_idx on public.audit_log (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Ledger is append-only for everyone, including the service role. The only
-- exception is the cascade from deleting the whole household (Danger zone),
-- where the parent household row is already gone.
create or replace function public.ledger_block_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.households h where h.id = old.household_id) then
    return old;
  end if;
  raise exception 'ledger_entries is append-only; add an adjustment instead';
end $$;

create trigger ledger_entries_no_update before update on public.ledger_entries
  for each row execute function public.ledger_block_mutation();
create trigger ledger_entries_no_delete before delete on public.ledger_entries
  for each row execute function public.ledger_block_mutation();

-- Rows that reference a kid/chore must live in the same household.
create or replace function public.enforce_same_household()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name in ('submissions','chore_assignees') then
    if not exists (select 1 from public.chores c where c.id = new.chore_id and c.household_id = new.household_id) then
      raise exception 'chore does not belong to household';
    end if;
  end if;
  if not exists (select 1 from public.kids k where k.id = new.kid_id and k.household_id = new.household_id) then
    raise exception 'kid does not belong to household';
  end if;
  return new;
end $$;

create trigger submissions_same_household before insert or update of kid_id, chore_id, household_id
  on public.submissions for each row execute function public.enforce_same_household();
create trigger chore_assignees_same_household before insert or update
  on public.chore_assignees for each row execute function public.enforce_same_household();
create trigger ledger_same_household before insert
  on public.ledger_entries for each row execute function public.enforce_same_household();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger chores_touch before update on public.chores
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Balances
-- ---------------------------------------------------------------------------

create view public.kid_balances with (security_invoker = true) as
select
  k.id as kid_id,
  k.household_id,
  coalesce((select sum(l.amount_cents) from public.ledger_entries l where l.kid_id = k.id), 0)::int as balance_cents,
  coalesce((select sum(s.amount_cents) from public.submissions s
            where s.kid_id = k.id and s.status = 'pending'), 0)::int as pending_cents
from public.kids k;
