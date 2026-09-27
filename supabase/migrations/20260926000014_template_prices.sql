-- Kid-sized starter prices ($0.50-$2 for most chores), based on the amounts the
-- owner set on his own board. Existing household chores are not changed.
update public.chore_templates t set price_cents = p.cents
from (values
  ('car_mats', 200), ('garage_sweep', 200), ('summer_wrapup', 500), ('garden_closedown', 200),
  ('terrace', 200), ('barbecue', 200), ('kitchen_cabinets', 100), ('sous_chef', 200),
  ('bathroom_deep', 200), ('bin_boss', 100), ('baseboards', 200), ('switches', 200),
  ('laundry', 200), ('shoe_station', 100), ('closet_swap', 200), ('basement_toys', 200)
) as p(key, cents)
where t.key = p.key;

-- A 50-cent daily chore: make your bed.
insert into public.chore_templates
  (key, locale, title, description, emoji, price_cents, unit_label, max_quantity, repeat_kind, repeat_every_days, scope, season, category, sort_order)
values
  ('make_bed','en','Make your bed','Pull up the sheets and the blanket, fluff the pillow, and put the stuffed animals back.',U&'\+01F6CF',50,null,1,'daily',null,'per_kid',null,'organizing',5),
  ('make_bed','fr','Faire ton lit',U&'Remonte les draps et la couverture, place l''oreiller et remets les toutous \00E0 leur place.',U&'\+01F6CF',50,null,1,'daily',null,'per_kid',null,'organizing',5)
on conflict (key, locale) do update set
  title = excluded.title, description = excluded.description, emoji = excluded.emoji, price_cents = excluded.price_cents,
  repeat_kind = excluded.repeat_kind, scope = excluded.scope, category = excluded.category, sort_order = excluded.sort_order;
