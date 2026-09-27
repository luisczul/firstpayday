-- Undoing an approval as a reversal puts the chore back on the board, parents can make
-- any chore available again right away ("Make available now"), and a kid can give up a
-- sent-back chore that turned out too hard ("withdrawn").

-- 1) A reversed approval no longer counts for cooldowns: it gets its own status.
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check
  check (status in ('pending','approved','sent_back','rejected','reversed','withdrawn'));

alter table public.submission_events drop constraint if exists submission_events_event_check;
alter table public.submission_events add constraint submission_events_event_check
  check (event in ('submitted','resubmitted','approved','sent_back','rejected','reopened','reversed','withdrawn'));

-- Earlier reversals were stored as 'rejected' with a 'reversed' event: fix them up.
update public.submissions s set status = 'reversed'
 where s.status = 'rejected'
   and exists (select 1 from public.submission_events e where e.submission_id = s.id and e.event = 'reversed');

-- 2) "Make available now": submissions before this moment stop counting for cooldowns.
alter table public.chores add column if not exists reset_at timestamptz;

CREATE OR REPLACE FUNCTION public.reopen_submission(p_submission_id uuid, p_comment text, p_mode text)
 RETURNS submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sub public.submissions;
  v_uid uuid := (select auth.uid());
  v_net int;
begin
  if p_mode not in ('revision','reverse') then
    raise exception 'mode must be revision or reverse' using errcode = '22023';
  end if;
  if coalesce(trim(p_comment), '') = '' then
    raise exception 'a comment is required' using errcode = '22023';
  end if;
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or not public.is_member(v_sub.household_id) then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if not public.household_has_full_access(v_sub.household_id) then
    raise exception 'household is read-only' using errcode = '42501';
  end if;
  if v_sub.status <> 'approved' then
    raise exception 'submission is %', v_sub.status using errcode = '22023';
  end if;

  -- Whatever this submission put in the kid's bank (earning + match - earlier undos) comes back out.
  select coalesce(sum(amount_cents), 0)::int into v_net from public.ledger_entries where submission_id = v_sub.id;
  if v_net <> 0 then
    insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note, created_by)
    values (v_sub.household_id, v_sub.kid_id, 'adjustment', -v_net, v_sub.id,
            case when p_mode = 'revision' then 'Needs a revision: ' else 'Approval reversed: ' end || v_sub.chore_title_snapshot,
            v_uid);
  end if;

  update public.submissions
     set status = case when p_mode = 'revision' then 'sent_back' else 'reversed' end,
         reviewed_at = now(), reviewed_by = v_uid, review_comment = trim(p_comment)
   where id = v_sub.id
  returning * into v_sub;

  insert into public.submission_events (submission_id, household_id, event, comment, actor_user_id)
  values (v_sub.id, v_sub.household_id, case when p_mode = 'revision' then 'reopened' else 'reversed' end, trim(p_comment), v_uid);
  return v_sub;
end $function$;

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


-- 3) A kid gives up a chore a parent sent back ("too hard for me"): it leaves Needs fixing
--    and the chore is free again. Nothing was paid for a sent-back chore, so no money moves.
create or replace function public.kiosk_withdraw_submission(
  p_household_id uuid, p_kid_id uuid, p_submission_id uuid
) returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.submissions;
begin
  select * into v_sub from public.submissions
   where id = p_submission_id and household_id = p_household_id and kid_id = p_kid_id
   for update;
  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_sub.status = 'withdrawn' then
    return v_sub;
  end if;
  if v_sub.status <> 'sent_back' then
    raise exception 'submission is %', v_sub.status using errcode = '22023';
  end if;
  update public.submissions set status = 'withdrawn' where id = v_sub.id returning * into v_sub;
  insert into public.submission_events (submission_id, household_id, event)
  values (v_sub.id, p_household_id, 'withdrawn');
  return v_sub;
end $$;

revoke execute on function public.kiosk_withdraw_submission(uuid, uuid, uuid) from anon, authenticated, public;
