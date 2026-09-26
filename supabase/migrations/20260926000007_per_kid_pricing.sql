-- Pricing: first kid free forever, $5/month per extra kid (Stripe quantity).
-- Mirrors lib/billing/access.ts getHouseholdAccess().

alter table public.subscriptions add column if not exists quantity int;

create or replace function public.household_has_full_access(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
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
