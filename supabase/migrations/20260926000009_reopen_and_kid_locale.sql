-- 1) Parents can undo an approval: take the money back (append-only
--    adjustment) and either ask for a revision or reverse it for good.
-- 2) Each kid can see their board in their own language.

-- A submission can now be approved more than once (approve → undo → fix →
-- approve), so one earning per submission is no longer an invariant.
-- Idempotency stays in approve_submission() (row lock + status check).
drop index if exists public.ledger_entries_one_earning_per_submission;

alter table public.submission_events drop constraint if exists submission_events_event_check;
alter table public.submission_events add constraint submission_events_event_check
  check (event in ('submitted','resubmitted','approved','sent_back','rejected','reopened','reversed'));

alter table public.kids add column if not exists locale text check (locale is null or locale in ('en','fr'));

create or replace function public.reopen_submission(p_submission_id uuid, p_comment text, p_mode text)
returns public.submissions
language plpgsql security definer set search_path = '' as $$
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

  -- Whatever this submission put in the kid's bank (earning + match − earlier undos) comes back out.
  select coalesce(sum(amount_cents), 0)::int into v_net from public.ledger_entries where submission_id = v_sub.id;
  if v_net <> 0 then
    insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note, created_by)
    values (v_sub.household_id, v_sub.kid_id, 'adjustment', -v_net, v_sub.id,
            case when p_mode = 'revision' then 'Needs a revision: ' else 'Approval reversed: ' end || v_sub.chore_title_snapshot,
            v_uid);
  end if;

  update public.submissions
     set status = case when p_mode = 'revision' then 'sent_back' else 'rejected' end,
         reviewed_at = now(), reviewed_by = v_uid, review_comment = trim(p_comment)
   where id = v_sub.id
  returning * into v_sub;

  insert into public.submission_events (submission_id, household_id, event, comment, actor_user_id)
  values (v_sub.id, v_sub.household_id, case when p_mode = 'revision' then 'reopened' else 'reversed' end, trim(p_comment), v_uid);
  return v_sub;
end $$;

revoke execute on function public.reopen_submission(uuid, text, text) from anon, public;
grant execute on function public.reopen_submission(uuid, text, text) to authenticated;
