-- Parents can share First Payday with friends by email and follow what happened.
-- Rows are written only by the server (service role) after it checks the parent's
-- session; parents of the household can read their household's rows.
create table if not exists public.share_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320),
  locale text not null default 'en' check (locale in ('en','fr','es','pt')),
  sent_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  send_count integer not null default 1 check (send_count >= 1),
  joined_user_id uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  unique (household_id, email)
);
create index if not exists share_invites_email_idx on public.share_invites (email) where joined_user_id is null;
create index if not exists share_invites_household_sent_idx on public.share_invites (household_id, sent_at desc);

alter table public.share_invites enable row level security;

create policy share_invites_select on public.share_invites
  for select to authenticated
  using (public.is_member(household_id));

revoke all on public.share_invites from anon, authenticated;
grant select on public.share_invites to authenticated;

-- A new account whose email was invited marks those invitations as joined.
-- Never blocks a signup: any error here is swallowed.
create or replace function public.mark_share_invites_joined()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.email is not null then
    begin
      update public.share_invites
         set joined_user_id = new.id, joined_at = now()
       where email = lower(new.email) and joined_user_id is null;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.mark_share_invites_joined() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_share_invites on auth.users;
create trigger on_auth_user_created_share_invites
  after insert on auth.users
  for each row execute function public.mark_share_invites_joined();

-- Server-only: does an account with this email exist? Answers just yes/no.
create or replace function public.email_has_account(p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email)));
$$;
revoke execute on function public.email_has_account(text) from public, anon, authenticated;
grant execute on function public.email_has_account(text) to service_role;
