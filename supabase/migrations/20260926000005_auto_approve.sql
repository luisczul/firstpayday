-- Chores with requires_approval = false pay out immediately on "I did it!".

create or replace function public.kiosk_create_submission(
  p_household_id uuid, p_kid_id uuid, p_chore_id uuid, p_quantity int,
  p_idempotency_key text, p_device_id uuid, p_expected_last_id uuid
) returns public.submissions
language plpgsql security definer set search_path = '' as $$
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
end $$;

revoke execute on function public.kiosk_create_submission(uuid, uuid, uuid, int, text, uuid, uuid) from anon, authenticated, public;
grant execute on function public.kiosk_create_submission(uuid, uuid, uuid, int, text, uuid, uuid) to service_role;
