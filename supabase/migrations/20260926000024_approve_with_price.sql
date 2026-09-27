-- Parents can correct a chore's price when approving it (and optionally keep that price
-- for next time). Replaces the 4-argument approve_submission; callers use named args.
drop function if exists public.approve_submission(uuid, int, text, int);

CREATE FUNCTION public.approve_submission(p_submission_id uuid, p_quantity integer DEFAULT NULL::integer, p_comment text DEFAULT NULL::text, p_bonus_cents integer DEFAULT 0, p_unit_price_cents integer DEFAULT NULL::integer, p_update_chore_price boolean DEFAULT false)
 RETURNS submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sub public.submissions;
  v_max int;
  v_qty int;
  v_amount int;
  v_match_pct int;
  v_bonus int := coalesce(p_bonus_cents, 0);
  v_price int;
  v_uid uuid := (select auth.uid());
begin
  if v_bonus < 0 or v_bonus > 10000 then
    raise exception 'bonus out of range' using errcode = '22023';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or not public.is_member(v_sub.household_id) then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_sub.status = 'approved' then
    return v_sub; -- idempotent (a repeated call never pays the bonus twice)
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
  -- The parent can correct the price at approval (e.g. the chore was priced wrong).
  v_price := coalesce(p_unit_price_cents, v_sub.unit_price_cents);
  if v_price < 0 or v_price > 100000 then
    raise exception 'price out of range' using errcode = '22023';
  end if;
  v_amount := v_qty * v_price;

  update public.submissions
     set status = 'approved', quantity = v_qty, unit_price_cents = v_price, amount_cents = v_amount,
         reviewed_at = now(), reviewed_by = v_uid,
         review_comment = coalesce(nullif(trim(p_comment), ''), review_comment)
   where id = v_sub.id
  returning * into v_sub;

  insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note, created_by)
  values (v_sub.household_id, v_sub.kid_id, 'earning', v_amount, v_sub.id, v_sub.chore_title_snapshot, v_uid);

  -- The savings match applies to the chore's price only, not to the tip.
  select h.savings_match_percent into v_match_pct from public.households h where h.id = v_sub.household_id;
  if v_match_pct > 0 and v_amount > 0 then
    insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note, created_by)
    values (v_sub.household_id, v_sub.kid_id, 'match', (v_amount * v_match_pct) / 100, v_sub.id,
            'Savings match ' || v_match_pct || '%', v_uid);
  end if;

  if v_bonus > 0 then
    insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note, created_by)
    values (v_sub.household_id, v_sub.kid_id, 'bonus', v_bonus, v_sub.id, 'Bonus: ' || v_sub.chore_title_snapshot, v_uid);
  end if;

  insert into public.submission_events (submission_id, household_id, event, comment, actor_user_id)
  values (v_sub.id, v_sub.household_id, 'approved', nullif(trim(p_comment), ''), v_uid);

  if p_update_chore_price and p_unit_price_cents is not null then
    update public.chores set price_cents = v_price where id = v_sub.chore_id and household_id = v_sub.household_id;
  end if;

  update public.households set last_activity_at = now() where id = v_sub.household_id;
  return v_sub;
end $function$;

revoke execute on function public.approve_submission(uuid, int, text, int, int, boolean) from anon, public;
grant execute on function public.approve_submission(uuid, int, text, int, int, boolean) to authenticated;
