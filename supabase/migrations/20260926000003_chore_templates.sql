-- Starter chore templates (SPEC §10). Reference data, so it ships as a
-- migration and reaches production with `supabase db push`.

insert into public.chore_templates
  (key, locale, title, description, emoji, price_cents, unit_label, max_quantity, repeat_kind, repeat_every_days, scope, season, category, sort_order)
values
  ('car_mats','en','Car mats & vacuum','Pull out every car mat, vacuum the car, clean the mats perfectly and put them back.','🚗',500,null,1,'every_n_days',14,'household',null,'car_garage',10),
  ('garage_sweep','en','Garage sweep','Sweep and clean every floor area of the garage.','🧹',500,null,1,'every_n_days',14,'household',null,'car_garage',20),
  ('summer_wrapup','en','Summer wrap-up','Bring the summer clothes down, carry the outdoor furniture in front of the cabin, and line up everything that goes in the garage in front of the garage.','🏕️',1000,null,1,'once',null,'household','fall','outdoor',30),
  ('garden_closedown','en','Garden close-down','Pull the finished plants, empty the pots, stack them in the shed.','🪴',800,null,1,'once',null,'household','fall','outdoor',40),
  ('terrace','en','Clean the terrace 100%','Sweep, wash and clear the whole terrace until it''s spotless. Furniture wiped, nothing left lying around.','🪑',1000,null,1,'every_n_days',14,'household',null,'outdoor',50),
  ('barbecue','en','Clean the barbecue 100%','Scrub the grill grates, empty the grease tray, wipe the outside and the side tables. With a parent nearby, and only when it''s cold.','🍖',800,null,1,'every_n_days',14,'household',null,'outdoor',60),
  ('kitchen_cabinets','en','Kitchen cabinets','Clean every single kitchen cabinet, doors and handles.','🍽️',500,null,1,'every_n_days',14,'household',null,'kitchen',70),
  ('sous_chef','en','Sous-chef night','Help prep and cook one dinner start to finish, then wipe the counters.','👩‍🍳',500,null,1,'weekly',null,'per_kid',null,'kitchen',80),
  ('bathroom_deep','en','Bathroom deep clean','Mirror, sink, toilet, floor, fresh towels stocked.','🛁',700,null,1,'weekly',null,'household',null,'cleaning',90),
  ('bin_boss','en','Garbage boss','Empty every garbage bin in the house and bring the garbage and recycling out to the street.','🗑️',500,null,1,'weekly',null,'household',null,'cleaning',100),
  ('baseboards','en','Baseboards','Take a wet towel and clean every single baseboard on the floor.','🧽',500,'floor',3,'every_n_days',14,'household',null,'cleaning',110),
  ('switches','en','Switches, handles & remotes','Clean every light switch, door handle and remote with cleaner.','💡',500,'floor',3,'weekly',null,'household',null,'cleaning',120),
  ('laundry','en','Laundry manager','Do the complete laundry: sort, wash, dry, fold and deliver to every room.','🧺',500,null,1,'weekly',null,'household',null,'laundry',130),
  ('shoe_station','en','Entryway shoe station','Organize every single shoe and boot in the entryway, lined up perfectly.','👟',200,null,1,'weekly',null,'household',null,'organizing',140),
  ('closet_swap','en','Winter closet swap','Box summer clothes, bring out coats and boots, put outgrown things in the donate bag.','🧥',600,null,1,'once',null,'per_kid','fall','organizing',150),
  ('basement_toys','en','Basement toy audit','Go through the whole basement, decide which toys we give away and which we keep, and organize everything by category.','🧸',600,null,1,'every_n_days',90,'household',null,'organizing',160),

  ('car_mats','fr','Tapis d''auto et aspirateur','Sors tous les tapis de l''auto, passe l''aspirateur, nettoie les tapis parfaitement et remets-les en place.','🚗',500,null,1,'every_n_days',14,'household',null,'car_garage',10),
  ('garage_sweep','fr','Balayer le garage','Balaie et nettoie tout le plancher du garage.','🧹',500,null,1,'every_n_days',14,'household',null,'car_garage',20),
  ('summer_wrapup','fr','Ranger l''été','Descends les vêtements d''été, transporte les meubles d''extérieur devant le chalet et aligne tout ce qui va dans le garage devant le garage.','🏕️',1000,null,1,'once',null,'household','fall','outdoor',30),
  ('garden_closedown','fr','Fermer le jardin','Arrache les plantes finies, vide les pots et empile-les dans le cabanon.','🪴',800,null,1,'once',null,'household','fall','outdoor',40),
  ('terrace','fr','Nettoyer la terrasse à 100 %','Balaie, lave et dégage toute la terrasse jusqu''à ce qu''elle brille. Meubles essuyés, rien qui traîne.','🪑',1000,null,1,'every_n_days',14,'household',null,'outdoor',50),
  ('barbecue','fr','Nettoyer le barbecue à 100 %','Frotte les grilles, vide le bac à graisse, essuie l''extérieur et les tablettes. Avec un parent à côté, et seulement quand il est froid.','🍖',800,null,1,'every_n_days',14,'household',null,'outdoor',60),
  ('kitchen_cabinets','fr','Armoires de cuisine','Nettoie chaque armoire de cuisine, les portes et les poignées.','🍽️',500,null,1,'every_n_days',14,'household',null,'kitchen',70),
  ('sous_chef','fr','Soirée sous-chef','Aide à préparer et cuisiner un souper du début à la fin, puis essuie les comptoirs.','👩‍🍳',500,null,1,'weekly',null,'per_kid',null,'kitchen',80),
  ('bathroom_deep','fr','Grand ménage de la salle de bain','Miroir, lavabo, toilette, plancher et serviettes propres.','🛁',700,null,1,'weekly',null,'household',null,'cleaning',90),
  ('bin_boss','fr','Chef des poubelles','Vide toutes les poubelles de la maison et sors les vidanges et le recyclage au chemin.','🗑️',500,null,1,'weekly',null,'household',null,'cleaning',100),
  ('baseboards','fr','Plinthes','Prends une serviette mouillée et nettoie chaque plinthe de l''étage.','🧽',500,'étage',3,'every_n_days',14,'household',null,'cleaning',110),
  ('switches','fr','Interrupteurs, poignées et télécommandes','Nettoie chaque interrupteur, poignée de porte et télécommande avec du nettoyant.','💡',500,'étage',3,'weekly',null,'household',null,'cleaning',120),
  ('laundry','fr','Responsable du lavage','Fais tout le lavage : trier, laver, sécher, plier et livrer dans chaque chambre.','🧺',500,null,1,'weekly',null,'household',null,'laundry',130),
  ('shoe_station','fr','Coin des souliers','Range chaque soulier et chaque botte de l''entrée, bien alignés.','👟',200,null,1,'weekly',null,'household',null,'organizing',140),
  ('closet_swap','fr','Garde-robe d''hiver','Range les vêtements d''été, sors les manteaux et les bottes, mets ce qui est trop petit dans le sac à donner.','🧥',600,null,1,'once',null,'per_kid','fall','organizing',150),
  ('basement_toys','fr','Tri des jouets du sous-sol','Fais le tour du sous-sol, décide quels jouets on donne et lesquels on garde, et range tout par catégorie.','🧸',600,null,1,'every_n_days',90,'household',null,'organizing',160)
on conflict (key, locale) do update set
  title = excluded.title, description = excluded.description, emoji = excluded.emoji,
  price_cents = excluded.price_cents, unit_label = excluded.unit_label, max_quantity = excluded.max_quantity,
  repeat_kind = excluded.repeat_kind, repeat_every_days = excluded.repeat_every_days, scope = excluded.scope,
  season = excluded.season, category = excluded.category, sort_order = excluded.sort_order;
