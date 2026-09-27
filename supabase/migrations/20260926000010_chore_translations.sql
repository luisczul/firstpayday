-- Chore text in every board language, filled by the app when a parent saves
-- a chore ({"en": {"title", "description", "unit_label", "note_for_kids"}, "fr": {...}}).
alter table public.chores add column if not exists translations jsonb not null default '{}'::jsonb;
