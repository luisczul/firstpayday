-- Billing is off for now: every household has full access and unlimited kids.
-- To turn per-kid pricing back on, make billing_enforced() return true (and set
-- BILLING_ENABLED=true in the app). Mirrors lib/billing/access.ts.
create or replace function public.billing_enforced()
returns boolean language sql immutable set search_path = '' as $$ select false $$;

create or replace function public.household_has_full_access(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not public.billing_enforced() or coalesce((
    select
      s.plan = 'comp'
      or (s.plan = 'trial' and s.trial_ends_at > now())
      or (s.stripe_subscription_id is not null and (
            s.status in ('active','trialing')
            or (s.status = 'past_due' and coalesce(s.past_due_since, now()) > now() - interval '7 days')))
      or (select count(*) from public.kids k where k.household_id = hid and k.archived_at is null) <= 1
    from public.subscriptions s where s.household_id = hid
  ), false);
$$;
