-- "A chore is ready for review" emails (sent after a kiosk submit/resubmit).
--   review_emails_enabled: per-parent opt-out, default on. The member may flip
--     their own flag (members_update_self RLS limits them to their own row).
--   review_email_sent_at: throttle stamp, written only by the service role so
--     one kid tapping six chores sends each parent one email, not six.
alter table public.household_members
  add column review_emails_enabled boolean not null default true,
  add column review_email_sent_at timestamptz;

grant select (review_emails_enabled) on public.household_members to authenticated;
grant update (review_emails_enabled) on public.household_members to authenticated;
