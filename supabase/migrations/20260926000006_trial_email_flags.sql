-- Remember which trial emails went out so the daily cron never double-sends.
alter table public.subscriptions
  add column trial_reminder_sent_at timestamptz,
  add column trial_ended_email_sent_at timestamptz;
