-- Custom rewards: a parent adds money to a kid's balance for something that
-- isn't in the chore list ("helped me carry the groceries"). It stays a normal
-- 'adjustment' ledger row, now with an icon, a short name and, when a kid reads
-- another language, the name and description translated for the kid.

alter table public.ledger_entries
  add column if not exists icon text,
  add column if not exists title text,
  add column if not exists translations jsonb;

alter table public.ledger_entries drop constraint if exists ledger_custom_fields;
alter table public.ledger_entries add constraint ledger_custom_fields check (
  (icon is null or char_length(icon) between 1 and 16)
  and (title is null or char_length(title) between 1 and 80)
  and (translations is null or jsonb_typeof(translations) = 'object')
);

-- The ledger stays append-only, with one exception: the reward's translations
-- are filled in a moment after it is saved (by the server, parents have no
-- update policy). An update that changes anything else is still refused.
create or replace function public.ledger_block_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.households h where h.id = old.household_id) then
    return old;
  end if;
  if tg_op = 'UPDATE' and old.kind = 'adjustment' and old.title is not null
     and (to_jsonb(new) - 'translations') = (to_jsonb(old) - 'translations') then
    return new;
  end if;
  raise exception 'ledger_entries is append-only; add an adjustment instead';
end $$;
