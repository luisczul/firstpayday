-- Row-level security, helpers and transactional functions (SPEC §4, §8, §19.5).

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_owner(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins p where p.user_id = (select auth.uid()));
$$;

-- Mirrors lib/billing/access.ts getHouseholdAccess(): true = 'full'.
create or replace function public.household_has_full_access(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.household_id = hid and (
      s.plan = 'comp'
      or (s.status = 'trialing' and s.trial_ends_at > now())
      or s.status = 'active'
      or (s.status = 'past_due' and coalesce(s.past_due_since, now()) > now() - interval '7 days')
    )
  );
$$;

create or replace function public.can_write(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_member(hid) and public.household_has_full_access(hid);
$$;

revoke execute on function public.is_member(uuid), public.is_owner(uuid), public.is_platform_admin(),
  public.household_has_full_access(uuid), public.can_write(uuid) from anon, public;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.is_platform_admin(),
  public.household_has_full_access(uuid), public.can_write(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.kids enable row level security;
alter table public.chores enable row level security;
alter table public.chore_assignees enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_events enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.devices enable row level security;
alter table public.chore_templates enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_log enable row level security;

-- households: members read; members update settings while writable; owner deletes.
create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.can_write(id)) with check (public.can_write(id));
create policy households_delete on public.households for delete to authenticated
  using (public.is_owner(id));
-- Inserts go through create_household().

-- household_members: members see each other; owner removes; a member edits own row.
create policy members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));
create policy members_update_self on public.household_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy members_delete on public.household_members for delete to authenticated
  using (public.is_owner(household_id) or user_id = (select auth.uid()));

-- invites: owners manage.
create policy invites_select on public.household_invites for select to authenticated
  using (public.is_owner(household_id));
create policy invites_delete on public.household_invites for delete to authenticated
  using (public.is_owner(household_id));
-- Inserts happen server-side after plan-limit checks.

-- kids
create policy kids_select on public.kids for select to authenticated
  using (public.is_member(household_id));
create policy kids_insert on public.kids for insert to authenticated
  with check (public.can_write(household_id));
create policy kids_update on public.kids for update to authenticated
  using (public.can_write(household_id)) with check (public.can_write(household_id));

-- chores
create policy chores_select on public.chores for select to authenticated
  using (public.is_member(household_id));
create policy chores_insert on public.chores for insert to authenticated
  with check (public.can_write(household_id));
create policy chores_update on public.chores for update to authenticated
  using (public.can_write(household_id)) with check (public.can_write(household_id));
-- FK (no action) from submissions blocks deleting chores that have history.
create policy chores_delete on public.chores for delete to authenticated
  using (public.can_write(household_id));

create policy assignees_select on public.chore_assignees for select to authenticated
  using (public.is_member(household_id));
create policy assignees_insert on public.chore_assignees for insert to authenticated
  with check (public.can_write(household_id));
create policy assignees_delete on public.chore_assignees for delete to authenticated
  using (public.can_write(household_id));

-- submissions: parents read; status changes only via functions below.
create policy submissions_select on public.submissions for select to authenticated
  using (public.is_member(household_id));
create policy submission_events_select on public.submission_events for select to authenticated
  using (public.is_member(household_id));

-- ledger: parents read, and insert payouts/adjustments directly. Earnings and
-- matches only come from approve_submission(). No update/delete policy exists.
create policy ledger_select on public.ledger_entries for select to authenticated
  using (public.is_member(household_id));
create policy ledger_insert on public.ledger_entries for insert to authenticated
  with check (
    public.can_write(household_id)
    and kind in ('payout','adjustment')
    and submission_id is null
    and created_by = (select auth.uid())
  );

-- devices
create policy devices_select on public.devices for select to authenticated
  using (public.is_member(household_id));
create policy devices_update on public.devices for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
-- Inserts happen server-side (token generation + plan-limit check).

-- templates: readable by everyone (landing page previews them too).
create policy templates_select on public.chore_templates for select to anon, authenticated
  using (true);

-- subscriptions: members read their own; only the service role writes.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_member(household_id));

-- stripe_events, platform_admins, audit_log: service role only (no policies).

-- ---------------------------------------------------------------------------
-- Household creation (sign-up → onboarding). Starts the 14-day trial.
-- ---------------------------------------------------------------------------

create or replace function public.create_household(
  p_name text, p_timezone text, p_currency text, p_locale text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'unknown timezone %', p_timezone using errcode = '22023';
  end if;

  insert into public.households (name, timezone, currency, locale, created_by)
  values (trim(p_name), p_timezone, upper(p_currency), p_locale, v_uid)
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, v_uid, 'owner');

  insert into public.subscriptions (household_id, plan, status, trial_ends_at)
  values (v_id, 'trial', 'trialing', now() + interval '14 days');

  return v_id;
end $$;

revoke execute on function public.create_household(text, text, text, text) from anon, public;
grant execute on function public.create_household(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Review functions (parents). Atomic and idempotent.
-- ---------------------------------------------------------------------------

create or replace function public.approve_submission(
  p_submission_id uuid, p_quantity int default null, p_comment text default null
) returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.submissions;
  v_max int;
  v_qty int;
  v_amount int;
  v_match_pct int;
  v_uid uuid := (select auth.uid());
begin
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or not public.is_member(v_sub.household_id) then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_sub.status = 'approved' then
    return v_sub; -- idempotent
  end if;
  if not public.household_has_full_access(v_sub.household_id) then
    raise exception 'household is read-only' using errcode = '42501';
  end if;
  if v_sub.status not in ('pending','sent_back') then
    raise exception 'submission is %', v_sub.status using errcode = '22023';
  end if;

  select c.max_quantity into v_max from public.chores c where c.id = v_sub.chore_id;
  v_qty := coalesce(p_quantity, v_sub.quantity);
  if v_qty < 1 or v_qty > greatest(v_max, v_sub.quantity) then
    raise exception 'quantity out of range' using errcode = '22023';
  end if;
  v_amount := v_qty * v_sub.unit_price_cents;

  update public.submissions
     set status = 'approved', quantity = v_qty, amount_cents = v_amount,
         reviewed_at = now(), reviewed_by = v_uid,
         review_comment = coalesce(nullif(trim(p_comment), ''), review_comment)
   where id = v_sub.id
  returning * into v_sub;

  insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note, created_by)
  values (v_sub.household_id, v_sub.kid_id, 'earning', v_amount, v_sub.id, v_sub.chore_title_snapshot, v_uid);

  select h.savings_match_percent into v_match_pct from public.households h where h.id = v_sub.household_id;
  if v_match_pct > 0 and v_amount > 0 then
    insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note, created_by)
    values (v_sub.household_id, v_sub.kid_id, 'match', (v_amount * v_match_pct) / 100, v_sub.id,
            'Savings match ' || v_match_pct || '%', v_uid);
  end if;

  insert into public.submission_events (submission_id, household_id, event, comment, actor_user_id)
  values (v_sub.id, v_sub.household_id, 'approved', nullif(trim(p_comment), ''), v_uid);

  update public.households set last_activity_at = now() where id = v_sub.household_id;
  return v_sub;
end $$;

create or replace function public.send_back_submission(p_submission_id uuid, p_comment text)
returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.submissions;
  v_uid uuid := (select auth.uid());
begin
  if coalesce(trim(p_comment), '') = '' then
    raise exception 'a comment is required' using errcode = '22023';
  end if;
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or not public.is_member(v_sub.household_id) then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_sub.status = 'sent_back' then
    return v_sub;
  end if;
  if not public.household_has_full_access(v_sub.household_id) then
    raise exception 'household is read-only' using errcode = '42501';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'submission is %', v_sub.status using errcode = '22023';
  end if;

  update public.submissions
     set status = 'sent_back', reviewed_at = now(), reviewed_by = v_uid, review_comment = trim(p_comment)
   where id = v_sub.id
  returning * into v_sub;

  insert into public.submission_events (submission_id, household_id, event, comment, actor_user_id)
  values (v_sub.id, v_sub.household_id, 'sent_back', trim(p_comment), v_uid);
  return v_sub;
end $$;

create or replace function public.reject_submission(p_submission_id uuid, p_reason text)
returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.submissions;
  v_uid uuid := (select auth.uid());
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or not public.is_member(v_sub.household_id) then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_sub.status = 'rejected' then
    return v_sub;
  end if;
  if not public.household_has_full_access(v_sub.household_id) then
    raise exception 'household is read-only' using errcode = '42501';
  end if;
  if v_sub.status not in ('pending','sent_back') then
    raise exception 'submission is %', v_sub.status using errcode = '22023';
  end if;

  update public.submissions
     set status = 'rejected', reviewed_at = now(), reviewed_by = v_uid, review_comment = trim(p_reason)
   where id = v_sub.id
  returning * into v_sub;

  insert into public.submission_events (submission_id, household_id, event, comment, actor_user_id)
  values (v_sub.id, v_sub.household_id, 'rejected', trim(p_reason), v_uid);
  return v_sub;
end $$;

revoke execute on function public.approve_submission(uuid, int, text), public.send_back_submission(uuid, text),
  public.reject_submission(uuid, text) from anon, public;
grant execute on function public.approve_submission(uuid, int, text), public.send_back_submission(uuid, text),
  public.reject_submission(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Kiosk functions (service role only; called from lib/kiosk/operations.ts,
-- which has already resolved household_id from the device token).
-- ---------------------------------------------------------------------------

-- Optimistic concurrency: the caller computed availability with
-- getChoreState() having seen p_expected_last_id as the newest blocking
-- submission. If a newer one appeared (a sibling tapped first), we refuse.
create or replace function public.kiosk_create_submission(
  p_household_id uuid, p_kid_id uuid, p_chore_id uuid, p_quantity int,
  p_idempotency_key text, p_device_id uuid, p_expected_last_id uuid
) returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare
  v_chore public.chores;
  v_latest uuid;
  v_sub public.submissions;
begin
  select * into v_sub from public.submissions
   where household_id = p_household_id and idempotency_key = p_idempotency_key;
  if found then
    return v_sub; -- same tap delivered twice
  end if;

  if not public.household_has_full_access(p_household_id) then
    raise exception 'board_paused' using errcode = '42501';
  end if;

  select * into v_chore from public.chores
   where id = p_chore_id and household_id = p_household_id and active
   for update;
  if not found then
    raise exception 'chore_unavailable' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.kids k where k.id = p_kid_id and k.household_id = p_household_id and k.archived_at is null) then
    raise exception 'kid_not_found' using errcode = 'P0002';
  end if;
  if p_quantity < 1 or p_quantity > v_chore.max_quantity then
    raise exception 'quantity out of range' using errcode = '22023';
  end if;

  select s.id into v_latest from public.submissions s
   where s.chore_id = p_chore_id
     and (v_chore.scope = 'household' or s.kid_id = p_kid_id)
   order by s.submitted_at desc, s.id desc
   limit 1;
  if v_latest is distinct from p_expected_last_id then
    raise exception 'already_taken' using errcode = '40001';
  end if;

  insert into public.submissions (
    household_id, chore_id, kid_id, quantity, unit_price_cents, amount_cents,
    chore_title_snapshot, status, device_id, idempotency_key
  ) values (
    p_household_id, p_chore_id, p_kid_id, p_quantity, v_chore.price_cents,
    p_quantity * v_chore.price_cents, v_chore.title, 'pending', p_device_id, p_idempotency_key
  ) returning * into v_sub;

  insert into public.submission_events (submission_id, household_id, event)
  values (v_sub.id, p_household_id, 'submitted');

  update public.households set last_activity_at = now() where id = p_household_id;
  return v_sub;
end $$;

create or replace function public.kiosk_resubmit(
  p_household_id uuid, p_kid_id uuid, p_submission_id uuid
) returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.submissions;
begin
  if not public.household_has_full_access(p_household_id) then
    raise exception 'board_paused' using errcode = '42501';
  end if;
  select * into v_sub from public.submissions
   where id = p_submission_id and household_id = p_household_id and kid_id = p_kid_id
   for update;
  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_sub.status = 'pending' then
    return v_sub;
  end if;
  if v_sub.status <> 'sent_back' then
    raise exception 'submission is %', v_sub.status using errcode = '22023';
  end if;

  update public.submissions
     set status = 'pending', resubmitted_at = now()
   where id = v_sub.id
  returning * into v_sub;

  insert into public.submission_events (submission_id, household_id, event)
  values (v_sub.id, p_household_id, 'resubmitted');
  return v_sub;
end $$;

revoke execute on function public.kiosk_create_submission(uuid, uuid, uuid, int, text, uuid, uuid),
  public.kiosk_resubmit(uuid, uuid, uuid) from anon, authenticated, public;
grant execute on function public.kiosk_create_submission(uuid, uuid, uuid, int, text, uuid, uuid),
  public.kiosk_resubmit(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime for the parent approval queue and balances.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.ledger_entries;

-- ---------------------------------------------------------------------------
-- Storage: private avatars bucket, path avatars/{household_id}/{kid_id}.webp
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.can_write(((storage.foldername(name))[1])::uuid));
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.can_write(((storage.foldername(name))[1])::uuid));
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.can_write(((storage.foldername(name))[1])::uuid));
