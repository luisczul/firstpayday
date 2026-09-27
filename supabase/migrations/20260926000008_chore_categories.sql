-- Kid board groups and filters cards by category (Garage, Outdoor, Kitchen...).
alter table public.chores add column if not exists category text not null default 'other'
  check (category in ('car_garage','outdoor','kitchen','cleaning','laundry','organizing','other'));

update public.chores c set category = t.category
from public.chore_templates t
where c.template_key = t.key and t.locale = 'en' and t.category is not null and c.category = 'other';
