-- Parents can send the owners a feature request, bug report or question.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  kind text not null check (kind in ('feature','bug','question','other')),
  message text not null check (char_length(message) between 1 and 4000),
  page text check (page is null or char_length(page) <= 300),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  status text not null default 'new' check (status in ('new','read','done')),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_created_idx on public.support_messages (created_at desc);
create index if not exists support_messages_user_idx on public.support_messages (user_id, created_at desc);

alter table public.support_messages enable row level security;

-- A parent sends messages as themselves, for a household they belong to, and
-- sees only their own messages. The platform owner reads all of them with the
-- service role. Nobody can update or delete through the API.
create policy support_messages_insert on public.support_messages
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new' and (household_id is null or public.is_member(household_id)));
create policy support_messages_select on public.support_messages
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select, insert on public.support_messages to authenticated;
