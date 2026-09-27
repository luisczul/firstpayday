-- 1) Kid check-ins: one row each time a kid taps their name on the kids'
--    tablet ("Who's here?" -> their board). Written only by the service role
--    (kiosk routes); parents can read their own household's rows.
-- 2) Weekly report email to parents: household-level day/hour (local time,
--    default Saturday 12:00), per-parent opt-out (default on), and a send stamp
--    the cron claims atomically so a double run never double-sends.
-- 3) email_log: one row per parent email actually sent, so the weekly report
--    can say how many "ready for review" emails went out.

create table public.kid_checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  created_at timestamptz not null default now()
);
create index kid_checkins_household_created_idx on public.kid_checkins (household_id, created_at desc);
create index kid_checkins_kid_created_idx on public.kid_checkins (kid_id, created_at desc);
create index kid_checkins_device_id_idx on public.kid_checkins (device_id);

alter table public.kid_checkins enable row level security;
create policy kid_checkins_select on public.kid_checkins for select to authenticated
  using (public.is_member(household_id));
-- No insert/update/delete policies: the kiosk writes with the service role.
revoke insert, update, delete, truncate on public.kid_checkins from authenticated, anon;

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('review_ready','weekly_report')),
  recipient_user_id uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now()
);
create index email_log_household_sent_idx on public.email_log (household_id, sent_at desc);

alter table public.email_log enable row level security;
create policy email_log_select on public.email_log for select to authenticated
  using (public.is_member(household_id));
revoke insert, update, delete, truncate on public.email_log from authenticated, anon;

alter table public.households
  add column weekly_report_dow smallint not null default 6 check (weekly_report_dow between 0 and 6),
  add column weekly_report_hour smallint not null default 12 check (weekly_report_hour between 0 and 23),
  add column weekly_report_last_sent_at timestamptz;

-- Per-parent opt-out; members flip their own flag (members_update_self RLS),
-- same pattern as review_emails_enabled in 20260926000012.
alter table public.household_members
  add column weekly_report_enabled boolean not null default true;

grant select (weekly_report_enabled) on public.household_members to authenticated;
grant update (weekly_report_enabled) on public.household_members to authenticated;
