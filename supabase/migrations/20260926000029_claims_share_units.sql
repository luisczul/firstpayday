-- Claims share the units. A chore with several units ("Leaves, up to 2") is no longer locked
-- for siblings as soon as one kid says "I'm on it!": a claim holds only the units it took.
-- Others can claim or send in what's left after the active claims of other kids
-- (units left this period - units claimed by others). Raising max_quantity on a chore a kid
-- already claimed frees the new units right away. A chore with one unit stays locked as before.

create or replace function public.chore_units_claimed_by_others(p_chore_id uuid, p_kid_id uuid, p_at timestamptz)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(c.quantity), 0)::int from public.chore_claims c
   where c.chore_id = p_chore_id and c.kid_id <> p_kid_id
     and c.released_at is null and c.expires_at > p_at;
$$;

revoke execute on function public.chore_units_claimed_by_others(uuid, uuid, timestamptz) from anon, authenticated, public;
grant execute on function public.chore_units_claimed_by_others(uuid, uuid, timestamptz) to service_role;

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
  v_others int;
  v_left int;
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
   where c.chore_id = p_chore_id and c.kid_id = p_kid_id and c.released_at is null and c.expires_at > now()
   order by c.claimed_at desc
   limit 1;
  if found then
    return v_claim; -- same tap delivered twice
  end if;

  -- Siblings' claims hold their units: one unit = the whole chore; several = only what they took.
  v_others := public.chore_units_claimed_by_others(p_chore_id, p_kid_id, now());
  if v_others > 0 then
    if v_chore.max_quantity <= 1 then
      raise exception 'chore_claimed' using errcode = '40001';
    end if;
    v_left := public.chore_units_left(p_chore_id, p_kid_id, now());
    if v_left - v_others <= 0 then
      raise exception 'chore_claimed' using errcode = '40001';
    end if;
  end if;

  if not public.chore_open_for_claim(p_chore_id, p_kid_id, now()) then
    raise exception 'chore_unavailable' using errcode = 'P0002';
  end if;
  -- Can't take more units than are left this period, after the siblings' claims.
  if v_chore.max_quantity > 1
     and p_quantity > public.chore_units_left(p_chore_id, p_kid_id, now()) - v_others then
    raise exception 'quantity out of range' using errcode = '22023';
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
  v_others int;
  v_left int;
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

  -- Another kid said "I'm on it!" and their time isn't up yet: a one-unit chore is theirs;
  -- with several units, only the units they took are held (the rest stay open).
  if v_chore.scope = 'household' then
    v_others := public.chore_units_claimed_by_others(p_chore_id, p_kid_id, now());
    if v_others > 0 then
      if v_chore.max_quantity <= 1 then
        raise exception 'chore_claimed' using errcode = '40001';
      end if;
      v_left := public.chore_units_left(p_chore_id, p_kid_id, now());
      if p_quantity <= v_left and p_quantity > v_left - v_others then
        raise exception 'chore_claimed' using errcode = '40001';
      end if;
    end if;
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
  -- Several units per period: only what's left can be sent in (the board shows the same number).
  if v_chore.max_quantity > 1 and p_quantity > public.chore_units_left(p_chore_id, p_kid_id, now()) then
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
