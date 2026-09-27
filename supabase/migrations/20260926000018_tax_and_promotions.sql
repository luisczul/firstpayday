-- 1) Optional family tax (off by default). When a parent records a payout,
--    part of it is withheld as "family tax": the payout row holds the net the
--    kid gets in hand and a separate 'tax' row (tied to the payout through
--    payout_id) holds the withheld part. Both rows reduce the balance, so the
--    kid's balance still shows everything they earned until it is paid out.
--    The family tax pot = all tax rows minus family treats recorded by parents.
-- 2) Promotions: parent-run bonus windows. Every chore SUBMITTED inside a
--    window earns the promotion bonus when it is approved (even later). The
--    bonus is its own ledger row (kind 'promo') tied to the submission, so
--    reopen_submission() (which takes back the NET per submission) also takes
--    the promotion back on undo.
--
-- The promotion is added by an AFTER INSERT trigger on the 'earning' ledger
-- row rather than inside approve_submission(): every path that pays a chore
-- (approve_submission, auto-approve in kiosk_create_submission, any future
-- redefinition of those functions) writes exactly one earning per approval,
-- so the trigger covers them all without redefining them here.

-- ---------------------------------------------------------------------------
-- Household settings
-- ---------------------------------------------------------------------------

alter table public.households add column if not exists tax_enabled boolean not null default false;
alter table public.households add column if not exists tax_percent int not null default 10;
alter table public.households drop constraint if exists households_tax_percent_check;
alter table public.households add constraint households_tax_percent_check check (tax_percent between 1 and 50);

-- ---------------------------------------------------------------------------
-- Ledger: new kinds 'tax' (<= 0) and 'promo' (>= 0), and the payout link
-- ---------------------------------------------------------------------------

alter table public.ledger_entries drop constraint if exists ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in ('earning','payout','adjustment','match','bonus','tax','promo'));

alter table public.ledger_entries drop constraint if exists ledger_sign;
alter table public.ledger_entries add constraint ledger_sign check (
  (kind in ('earning','match','bonus','promo') and amount_cents >= 0)
  or (kind in ('payout','tax') and amount_cents <= 0)
  or kind = 'adjustment'
);

alter table public.ledger_entries add column if not exists payout_id uuid references public.ledger_entries(id) on delete no action;
alter table public.ledger_entries drop constraint if exists ledger_tax_has_payout;
alter table public.ledger_entries add constraint ledger_tax_has_payout check ((kind = 'tax') = (payout_id is not null));
create index if not exists ledger_entries_payout_id_idx on public.ledger_entries (payout_id) where payout_id is not null;
create index if not exists ledger_entries_household_kind_idx on public.ledger_entries (household_id, kind);

-- Parents still insert plain payouts/adjustments directly; tax and promo rows
-- only come from the security-definer functions below.
drop policy if exists ledger_insert on public.ledger_entries;
create policy ledger_insert on public.ledger_entries for insert to authenticated
  with check (
    public.can_write(household_id)
    and kind in ('payout','adjustment')
    and submission_id is null
    and payout_id is null
    and created_by = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Payout with family tax withheld
-- ---------------------------------------------------------------------------

create or replace function public.record_payout(
  p_kid_id uuid, p_gross_cents int, p_method text, p_note text default null, p_allow_negative boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hid uuid;
  v_uid uuid := (select auth.uid());
  v_balance int;
  v_enabled boolean;
  v_pct int;
  v_tax int := 0;
  v_net int;
  v_payout_id uuid;
begin
  select k.household_id into v_hid from public.kids k where k.id = p_kid_id for update;
  if not found or not public.is_member(v_hid) then
    raise exception 'kid not found' using errcode = 'P0002';
  end if;
  if not public.household_has_full_access(v_hid) then
    raise exception 'household is read-only' using errcode = '42501';
  end if;
  if p_gross_cents is null or p_gross_cents <= 0 or p_gross_cents > 10000000 then
    raise exception 'amount out of range' using errcode = '22023';
  end if;
  if p_method is null or p_method not in ('cash','bank','savings','other') then
    raise exception 'invalid method' using errcode = '22023';
  end if;

  select coalesce(sum(l.amount_cents), 0)::int into v_balance from public.ledger_entries l where l.kid_id = p_kid_id;
  if not coalesce(p_allow_negative, false) and p_gross_cents > v_balance then
    raise exception 'exceeds balance' using errcode = '22023';
  end if;

  select h.tax_enabled, h.tax_percent into v_enabled, v_pct from public.households h where h.id = v_hid;
  if v_enabled then
    v_tax := round(p_gross_cents * v_pct / 100.0)::int;
  end if;
  v_net := p_gross_cents - v_tax;

  insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, method, note, created_by)
  values (v_hid, p_kid_id, 'payout', -v_net, p_method, nullif(trim(coalesce(p_note, '')), ''), v_uid)
  returning id into v_payout_id;

  if v_tax > 0 then
    insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, payout_id, note, created_by)
    values (v_hid, p_kid_id, 'tax', -v_tax, v_payout_id, 'Family tax ' || v_pct || '%', v_uid);
  end if;

  update public.households set last_activity_at = now() where id = v_hid;
  return jsonb_build_object('payout_id', v_payout_id, 'gross_cents', p_gross_cents, 'tax_cents', v_tax, 'net_cents', v_net);
end $$;

revoke execute on function public.record_payout(uuid, int, text, text, boolean) from anon, public;
grant execute on function public.record_payout(uuid, int, text, text, boolean) to authenticated;

-- Family treats paid from the tax pot (a dinner out, an ice-cream trip...).
create table if not exists public.family_pot_spends (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0 and amount_cents <= 10000000),
  note text not null check (length(trim(note)) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists family_pot_spends_household_idx on public.family_pot_spends (household_id, created_at desc);
alter table public.family_pot_spends enable row level security;

drop policy if exists pot_spends_select on public.family_pot_spends;
create policy pot_spends_select on public.family_pot_spends for select to authenticated
  using (public.is_member(household_id));
drop policy if exists pot_spends_insert on public.family_pot_spends;
create policy pot_spends_insert on public.family_pot_spends for insert to authenticated
  with check (public.can_write(household_id) and created_by = (select auth.uid()));
-- Append-only: no update/delete policies.

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  bonus_kind text not null check (bonus_kind in ('flat','percent')),
  bonus_value int not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_window check (ends_at > starts_at),
  constraint promotions_value check (
    (bonus_kind = 'flat' and bonus_value between 1 and 10000)
    or (bonus_kind = 'percent' and bonus_value between 1 and 200)
  )
);
create index if not exists promotions_household_window_idx on public.promotions (household_id, starts_at, ends_at);

drop trigger if exists promotions_touch on public.promotions;
create trigger promotions_touch before update on public.promotions
  for each row execute function public.touch_updated_at();

alter table public.promotions enable row level security;
drop policy if exists promotions_select on public.promotions;
create policy promotions_select on public.promotions for select to authenticated
  using (public.is_member(household_id));
drop policy if exists promotions_insert on public.promotions;
create policy promotions_insert on public.promotions for insert to authenticated
  with check (public.can_write(household_id));
drop policy if exists promotions_update on public.promotions;
create policy promotions_update on public.promotions for update to authenticated
  using (public.can_write(household_id)) with check (public.can_write(household_id));
-- Only promotions that haven't started can be deleted; running ones are ended early.
drop policy if exists promotions_delete on public.promotions;
create policy promotions_delete on public.promotions for delete to authenticated
  using (public.can_write(household_id) and starts_at > now());

-- The best single promotion active at p_at (overlapping windows never stack).
-- Percent is of the chore amount, rounded to cents; mirrors lib/promotions.ts.
create or replace function public.promo_bonus_at(p_household_id uuid, p_at timestamptz, p_amount_cents int)
returns table (promotion_id uuid, name text, bonus_cents int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name,
         (case when p.bonus_kind = 'flat' then p.bonus_value
               else round(greatest(p_amount_cents, 0) * p.bonus_value / 100.0) end)::int as bonus_cents
    from public.promotions p
   where p.household_id = p_household_id
     and p.starts_at <= p_at and p_at < p.ends_at
   order by 3 desc, p.ends_at asc, p.id
   limit 1;
$$;
revoke execute on function public.promo_bonus_at(uuid, timestamptz, int) from anon, authenticated, public;

create or replace function public.ledger_apply_promo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_at timestamptz;
  v_promo record;
begin
  select s.submitted_at into v_at from public.submissions s where s.id = new.submission_id;
  if v_at is null then
    return null;
  end if;
  select * into v_promo from public.promo_bonus_at(new.household_id, v_at, new.amount_cents);
  if found and v_promo.bonus_cents > 0 then
    insert into public.ledger_entries (household_id, kid_id, kind, amount_cents, submission_id, note, created_by)
    values (new.household_id, new.kid_id, 'promo', v_promo.bonus_cents, new.submission_id,
            'Promotion: ' || v_promo.name, new.created_by);
  end if;
  return null;
end $$;
revoke execute on function public.ledger_apply_promo() from anon, authenticated, public;

drop trigger if exists ledger_entries_apply_promo on public.ledger_entries;
create trigger ledger_entries_apply_promo after insert on public.ledger_entries
  for each row when (new.kind = 'earning' and new.submission_id is not null and new.amount_cents > 0)
  execute function public.ledger_apply_promo();
