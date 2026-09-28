-- Native apps (iOS / Android): each signed-in phone's push token, so a parent gets a
-- notification when a kid sends a chore. Only the server (service role) reads or writes
-- this table: RLS is on and there are no policies for parents.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (char_length(token) between 8 and 4096),
  platform text not null check (platform in ('ios','android')),
  locale text check (locale is null or locale in ('en','fr','es','pt')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
