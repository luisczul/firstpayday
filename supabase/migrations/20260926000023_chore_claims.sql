-- Claim a whole-house chore ("I'm on it!") so siblings don't race for it.
--
-- A kid claims a free whole-house chore (scope 'household', not a routine / checklist)
-- from the tablet. While the claim is active, other kids see the card locked and can't
-- send it in. The claim ends when the kid sends the chore in ('completed'), gives it back
-- ('given_back'), a parent releases it ('parent'), or its time runs out ('expired').
--
-- Expiry is lazy: a claim is active iff released_at is null and expires_at > now().
-- No cron job; the kiosk marks old ones 'expired' when it shows the kid the nudge.
--
-- A chore with a quantity (e.g. "$2 / floor, up to 3") is claimed for a number of units;
-- the kid can later send in that many or fewer, never more. While claimed, the whole
-- chore is locked for siblings (no splitting the remaining units).
--
-- How long a claim lasts is a per-chore setting (chores.claim_window):
-- 2 hours, 4 hours, until the end of the day (next local midnight in the household
-- timezone), 24 hours (default) or 48 hours.

-- 1) Per-chore time limit -----------------------------------------------------

alter table public.chores add column if not exists claim_window text not null default '24h';
alter table public.chores drop constraint if exists chores_claim_window_check;
alter table public.chores add constraint chores_claim_window_check
  check (claim_window in ('2h','4h','end_of_day','24h','48h'));
-- Existing chores got the '24h' default when the column was added (routines keep it, unused).

-- 2) Claims -------------------------------------------------------------------

create table public.chore_claims (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  chore_id uuid not null references public.chores(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  quantity int not null default 1 check (quantity >= 1),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  release_reason text check (release_reason in ('given_back','completed','expired','parent')),
  submission_id uuid references public.submissions(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  constraint chore_claims_expires_after_claim check (expires_at > claimed_at),
  constraint chore_claims_release_consistent check ((released_at is null) = (release_reason is null))
);
create index chore_claims_open_chore_idx on public.chore_claims (household_id, chore_id) where released_at is null;
create index chore_claims_open_kid_idx on public.chore_claims (kid_id) where released_at is null;
create index chore_claims_chore_idx on public.chore_claims (chore_id);
create index chore_claims_submission_idx on public.chore_claims (submission_id);
create index chore_claims_device_idx on public.chore_claims (device_id);

-- Same generic check as checklist ticks: chore and kid belong to the claim's household.
create trigger chore_claims_same_household before insert or update
  on public.chore_claims for each row execute function public.chore_subtask_checks_same_household();

alter table public.chore_claims enable row level security;
create policy chore_claims_select on public.chore_claims for select to authenticated
  using (public.is_member(household_id));
-- No insert/update/delete policies: the kiosk writes with the service role, parents
-- release through parent_release_claim().
revoke insert, update, delete, truncate on public.chore_claims from authenticated, anon;

-- 3) Is a chore free for this kid to claim right now? ----------------------------
-- Mirrors getChoreState (lib/schedule/getChoreState.ts) for whole-house chores:
-- assignees, a sent-back chore of this kid, the season window, and the cooldown from
-- the latest relevant submission (reversed / withdrawn never count, nor anything before
-- "Make available now" unless it is still pending or sent back).

create or replace function public.chore_open_for_claim(p_chore_id uuid, p_kid_id uuid, p_at timestamptz)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_chore public.chores;
  v_tz text;
  v_wso int;
  v_latest public.submissions;
  v_day date;
  v_next date;
begin
  select * into v_chore from public.chores where id = p_chore_id;
  if not found or not v_chore.active or v_chore.scope <> 'household'
     or jsonb_array_length(v_chore.subtasks) > 0 then
    return false;
  end if;
  if exists (select 1 from public.chore_assignees a where a.chore_id = v_chore.id)
     and not exists (select 1 from public.chore_assignees a where a.chore_id = v_chore.id and a.kid_id = p_kid_id) then
    return false;
  end if;
  -- This kid has it in Needs fixing.
  if exists (select 1 from public.submissions s where s.chore_id = v_chore.id and s.kid_id = p_kid_id and s.status = 'sent_back') then
    return false;
  end if;

  select h.timezone, h.week_starts_on into v_tz, v_wso from public.households h where h.id = v_chore.household_id;
  if v_chore.available_from is not null and p_at < (v_chore.available_from::timestamp at time zone v_tz) then
    return false;
  end if;
  if v_chore.available_until is not null and p_at >= ((v_chore.available_until + 1)::timestamp at time zone v_tz) then
    return false;
  end if;

  if v_chore.repeat_kind = 'once' then
    return not exists (
      select 1 from public.submissions s
       where s.chore_id = v_chore.id
         and s.status in ('approved','pending')
         and (v_chore.reset_at is null or s.submitted_at >= v_chore.reset_at or s.status = 'pending')
    );
  end if;

  select s.* into v_latest from public.submissions s
   where s.chore_id = v_chore.id
     and s.status not in ('reversed','withdrawn')
     and (v_chore.reset_at is null or s.submitted_at >= v_chore.reset_at or s.status in ('pending','sent_back'))
   order by s.submitted_at desc, s.id desc
   limit 1;
  if not found then
    return true;
  end if;
  v_day := (v_latest.submitted_at at time zone v_tz)::date;
  v_next := case v_chore.repeat_kind
    when 'daily' then v_day + 1
    when 'weekly' then v_day + 7 - ((extract(dow from v_day)::int - v_wso + 7) % 7)
    else v_day + greatest(1, coalesce(v_chore.repeat_every_days, 1))
  end;
  return p_at >= (v_next::timestamp at time zone v_tz);
end $$;

-- 4) Kiosk: claim, give back --------------------------------------------------------

create or replace function public.kiosk_claim_chore(
  p_household_id uuid, p_kid_id uuid, p_chore_id uuid, p_device_id uuid, p_quantity int
) returns public.chore_claims
language plpgsql security definer set search_path = '' as $$
declare
  v_chore public.chores;
  v_tz text;
  v_claim public.chore_claims;
  v_expires timestamptz;
  v_mine int;
begin
  if not public.household_has_full_access(p_household_id) then
    raise exception 'board_paused' using errcode = '42501';
  end if;
  -- Same lock as kiosk_create_submission: claims and submissions of a chore take turns.
  select * into v_chore from public.chores
   where id = p_chore_id and household_id = p_household_id and active
   for update;
  if not found then
    raise exception 'chore_unavailable' using errcode = 'P0002';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > v_chore.max_quantity then
    raise exception 'quantity out of range' using errcode = '22023';
  end if;
  -- One kid's claims take turns too (the limit of 2 can't be raced from two tablets).
  perform 1 from public.kids k
   where k.id = p_kid_id and k.household_id = p_household_id and k.archived_at is null
   for update;
  if not found then
    raise exception 'kid_not_found' using errcode = 'P0002';
  end if;

  select * into v_claim from public.chore_claims c
   where c.chore_id = p_chore_id and c.released_at is null and c.expires_at > now()
   order by c.claimed_at desc
   limit 1;
  if found then
    if v_claim.kid_id = p_kid_id then
      return v_claim; -- same tap delivered twice
    end if;
    raise exception 'chore_claimed' using errcode = '40001';
  end if;

  if not public.chore_open_for_claim(p_chore_id, p_kid_id, now()) then
    raise exception 'chore_unavailable' using errcode = 'P0002';
  end if;

  select count(*) into v_mine from public.chore_claims c
    join public.chores ch on ch.id = c.chore_id and ch.active
   where c.kid_id = p_kid_id and c.released_at is null and c.expires_at > now();
  if v_mine >= 2 then
    raise exception 'claim_limit' using errcode = '23514';
  end if;

  select h.timezone into v_tz from public.households h where h.id = p_household_id;
  v_expires := case v_chore.claim_window
    when '2h' then now() + interval '2 hours'
    when '4h' then now() + interval '4 hours'
    when 'end_of_day' then (((now() at time zone v_tz)::date + 1)::timestamp at time zone v_tz)
    when '48h' then now() + interval '48 hours'
    else now() + interval '24 hours'
  end;

  insert into public.chore_claims (household_id, chore_id, kid_id, quantity, expires_at, device_id)
  values (p_household_id, p_chore_id, p_kid_id, p_quantity, v_expires, p_device_id)
  returning * into v_claim;
  update public.households set last_activity_at = now() where id = p_household_id;
  return v_claim;
end $$;

create or replace function public.kiosk_release_claim(
  p_household_id uuid, p_kid_id uuid, p_claim_id uuid
) returns public.chore_claims
language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.chore_claims;
begin
  select * into v_claim from public.chore_claims
   where id = p_claim_id and household_id = p_household_id and kid_id = p_kid_id
   for update;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0002';
  end if;
  if v_claim.released_at is not null then
    return v_claim;
  end if;
  update public.chore_claims
     set released_at = least(now(), expires_at),
         release_reason = case when expires_at <= now() then 'expired' else 'given_back' end
   where id = v_claim.id
  returning * into v_claim;
  return v_claim;
end $$;

-- 5) Parent: release a kid's claim from Admin -> Chores ------------------------------

create or replace function public.parent_release_claim(p_claim_id uuid)
returns public.chore_claims
language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.chore_claims;
begin
  select * into v_claim from public.chore_claims where id = p_claim_id for update;
  if not found or not public.is_member(v_claim.household_id) then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if not public.household_has_full_access(v_claim.household_id) then
    raise exception 'household is read-only' using errcode = '42501';
  end if;
  if v_claim.released_at is not null then
    return v_claim;
  end if;
  update public.chore_claims
     set released_at = least(now(), expires_at),
         release_reason = case when expires_at <= now() then 'expired' else 'parent' end
   where id = v_claim.id
  returning * into v_claim;
  return v_claim;
end $$;

-- 6) Submitting: a claimed chore is only for the kid who claimed it ---------------------
-- Redefined from the current definition (20260926000021): same behaviour, plus
--   * refuse a whole-house chore another kid has claimed ('chore_claimed');
--   * the claimer sends in at most the quantity they claimed;
--   * the claimer's own claim ends as 'completed' with the new submission.

CREATE OR REPLACE FUNCTION public.kiosk_create_submission(p_household_id uuid, p_kid_id uuid, p_chore_id uuid, p_quantity integer, p_idempotency_key text, p_device_id uuid, p_expected_last_id uuid)
 RETURNS submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_chore public.chores;
  v_latest uuid;
  v_sub public.submissions;
  v_match_pct int;
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

  -- Another kid said "I'm on it!" and their time isn't up yet.
  if v_chore.scope = 'household' and exists (
    select 1 from public.chore_claims c
     where c.chore_id = p_chore_id and c.kid_id <> p_kid_id
       and c.released_at is null and c.expires_at > now()
  ) then
    raise exception 'chore_claimed' using errcode = '40001';
  end if;
  -- They took N units: they can send in N or fewer, not more.
  if exists (
    select 1 from public.chore_claims c
     where c.chore_id = p_chore_id and c.kid_id = p_kid_id
       and c.released_at is null and c.expires_at > now() and p_quantity > c.quantity
  ) then
    raise exception 'quantity out of range' using errcode = '22023';
  end if;

  select s.id into v_latest from public.submissions s
   where s.chore_id = p_chore_id
     and (v_chore.scope = 'household' or s.kid_id = p_kid_id)
     -- Mirrors getChoreState: reversed / given-up chores and anything before "Make available now" don't count.
     and s.status not in ('reversed','withdrawn')
     and (v_chore.reset_at is null or s.submitted_at >= v_chore.reset_at or s.status in ('pending','sent_back'))
   order by s.submitted_at desc, s.id desc
   limit 1;
  if v_latest is distinct from p_expected_last_id then
    raise exception 'already_taken' using errcode = '40001';
  end if;

  insert into public.submissions (
    household_id, chore_id, kid_id, quantity, unit_price_cents, amount_cents,
    chore_title_snapshot, status, device_id, idempotency_key,
    reviewed_at
  ) values (
    p_household_id, p_chore_id, p_kid_id, p_quantity, v_chore.price_cents,
    p_quantity * v_chore.price_cents, v_chore.title,
    case when v_chore.requires_approval then 'pending' else 'approved' end,
    p_device_id, p_idempotency_key,
    case when v_chore.requires_approval then null else now() end
  ) returning * into v_sub;

  insert into public.submission_events (submission_id, household_id, event)
  values (v_sub.id, p_household_id, 'submitted');

  -- The claimer finished it: their claim is done.
  update public.chore_claims
     set released_at = now(), release_reason = 'completed', submission_id = v_sub.id
   where chore_id = p_chore_id and kid_id = p_kid_id
     and released_at is null and expires_at > now();

  if not v_chore.requires_approval then
    insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note)
    values (p_household_id, p_kid_id, 'earning', v_sub.amount_cents, v_sub.id, v_sub.chore_title_snapshot);
    select h.savings_match_percent into v_match_pct from public.households h where h.id = p_household_id;
    if v_match_pct > 0 and v_sub.amount_cents > 0 then
      insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note)
      values (p_household_id, p_kid_id, 'match', (v_sub.amount_cents * v_match_pct) / 100, v_sub.id,
              'Savings match ' || v_match_pct || '%');
    end if;
    insert into public.submission_events (submission_id, household_id, event, comment)
    values (v_sub.id, p_household_id, 'approved', 'Auto-approved');
  end if;

  update public.households set last_activity_at = now() where id = p_household_id;
  return v_sub;
end $function$;

-- 7) Who may call what -------------------------------------------------------------

revoke execute on function public.chore_open_for_claim(uuid, uuid, timestamptz),
  public.kiosk_claim_chore(uuid, uuid, uuid, uuid, int),
  public.kiosk_release_claim(uuid, uuid, uuid) from anon, authenticated, public;
grant execute on function public.chore_open_for_claim(uuid, uuid, timestamptz),
  public.kiosk_claim_chore(uuid, uuid, uuid, uuid, int),
  public.kiosk_release_claim(uuid, uuid, uuid) to service_role;

revoke execute on function public.parent_release_claim(uuid) from anon, public;
grant execute on function public.parent_release_claim(uuid) to authenticated, service_role;

-- kiosk_create_submission keeps its original grants (service role only).
revoke execute on function public.kiosk_create_submission(uuid, uuid, uuid, int, text, uuid, uuid) from anon, authenticated, public;
