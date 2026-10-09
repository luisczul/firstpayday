-- Home maintenance: a category for small house repairs and upkeep (door-lock batteries,
-- smoke detectors, light bulbs, furnace filter, loose screws), with starter templates in 4 languages.
alter table public.chores drop constraint if exists chores_category_check;
alter table public.chores add constraint chores_category_check
  check (category in ('car_garage','outdoor','kitchen','cleaning','laundry','organizing','home_maintenance','other'));

insert into public.chore_templates
  (key, locale, title, description, emoji, price_cents, unit_label, max_quantity, repeat_kind, repeat_every_days, scope, season, category, sort_order)
values
  ('lock_batteries','en','Change the door lock batteries','Swap the batteries in the door lock (ask a parent which ones), check that it locks and unlocks, and put the old batteries in the recycling bin.',U&'\+01F50B',200,null,1,'every_n_days',180,'household',null,'home_maintenance',170),
  ('lock_batteries','fr','Changer les piles de la serrure',U&'Remplace les piles de la serrure de la porte (demande \00E0 un parent lesquelles), v\00E9rifie qu''elle se verrouille et se d\00E9verrouille, et mets les vieilles piles au recyclage.',U&'\+01F50B',200,null,1,'every_n_days',180,'household',null,'home_maintenance',170),
  ('lock_batteries','es','Cambiar las pilas de la cerradura',U&'Cambia las pilas de la cerradura de la puerta (pregunta a un adulto cu\00E1les), comprueba que cierra y abre bien, y lleva las pilas viejas al reciclaje.',U&'\+01F50B',200,null,1,'every_n_days',180,'household',null,'home_maintenance',170),
  ('lock_batteries','pt','Trocar as pilhas da fechadura','Troque as pilhas da fechadura da porta (pergunte a um adulto quais), confira se ela tranca e destranca, e leve as pilhas velhas para a reciclagem.',U&'\+01F50B',200,null,1,'every_n_days',180,'household',null,'home_maintenance',170),
  ('smoke_test','en','Test the smoke detectors','With a parent, press the test button on every smoke and CO detector in the house. Tell us if one doesn''t beep.',U&'\+01F9EF',100,null,1,'every_n_days',30,'household',null,'home_maintenance',171),
  ('smoke_test','fr',U&'Tester les d\00E9tecteurs de fum\00E9e',U&'Avec un parent, appuie sur le bouton test de chaque d\00E9tecteur de fum\00E9e et de CO de la maison. Dis-nous si l''un d''eux ne sonne pas.',U&'\+01F9EF',100,null,1,'every_n_days',30,'household',null,'home_maintenance',171),
  ('smoke_test','es','Probar los detectores de humo',U&'Con un adulto, presiona el bot\00F3n de prueba de cada detector de humo y de CO de la casa. Av\00EDsanos si alguno no suena.',U&'\+01F9EF',100,null,1,'every_n_days',30,'household',null,'home_maintenance',171),
  ('smoke_test','pt',U&'Testar os detectores de fuma\00E7a',U&'Com um adulto, aperte o bot\00E3o de teste de cada detector de fuma\00E7a e de CO da casa. Avise se algum n\00E3o apitar.',U&'\+01F9EF',100,null,1,'every_n_days',30,'household',null,'home_maintenance',171),
  ('light_bulbs','en','Replace burnt-out light bulbs','Find every light that''s out and replace the bulb with a parent''s help (switch off, lamp unplugged).',U&'\+01F4A1',100,null,1,'once',null,'household',null,'home_maintenance',172),
  ('light_bulbs','fr',U&'Remplacer les ampoules br\00FBl\00E9es',U&'Trouve toutes les lumi\00E8res qui ne marchent plus et change l''ampoule avec l''aide d''un parent (interrupteur ferm\00E9, lampe d\00E9branch\00E9e).',U&'\+01F4A1',100,null,1,'once',null,'household',null,'home_maintenance',172),
  ('light_bulbs','es','Cambiar los focos fundidos',U&'Encuentra todas las luces que no funcionan y cambia el foco con ayuda de un adulto (interruptor apagado, l\00E1mpara desenchufada).',U&'\+01F4A1',100,null,1,'once',null,'household',null,'home_maintenance',172),
  ('light_bulbs','pt',U&'Trocar as l\00E2mpadas queimadas',U&'Encontre todas as luzes que n\00E3o acendem e troque a l\00E2mpada com a ajuda de um adulto (interruptor desligado, abajur desconectado).',U&'\+01F4A1',100,null,1,'once',null,'household',null,'home_maintenance',172),
  ('furnace_filter','en','Change the furnace filter','With a parent, slide out the old filter, write today''s date on the new one and put it in with the arrow pointing the right way.',U&'\+01F527',200,null,1,'every_n_days',90,'household',null,'home_maintenance',173),
  ('furnace_filter','fr','Changer le filtre de la fournaise',U&'Avec un parent, retire le vieux filtre, \00E9cris la date d''aujourd''hui sur le nouveau et installe-le avec la fl\00E8che dans le bon sens.',U&'\+01F527',200,null,1,'every_n_days',90,'household',null,'home_maintenance',173),
  ('furnace_filter','es',U&'Cambiar el filtro de la calefacci\00F3n',U&'Con un adulto, saca el filtro viejo, escribe la fecha de hoy en el nuevo y col\00F3calo con la flecha en la direcci\00F3n correcta.',U&'\+01F527',200,null,1,'every_n_days',90,'household',null,'home_maintenance',173),
  ('furnace_filter','pt','Trocar o filtro do aquecedor','Com um adulto, tire o filtro velho, escreva a data de hoje no novo e coloque-o com a seta no sentido certo.',U&'\+01F527',200,null,1,'every_n_days',90,'household',null,'home_maintenance',173),
  ('tighten_screws','en','Tighten loose screws and handles','Go around the house with a screwdriver: cabinet handles, door hinges, chair legs. Tighten everything that wobbles.',U&'\+01FA9B',200,null,1,'every_n_days',90,'household',null,'home_maintenance',174),
  ('tighten_screws','fr',U&'Resserrer les vis et les poign\00E9es',U&'Fais le tour de la maison avec un tournevis : poign\00E9es d''armoires, pentures de portes, pattes de chaises. Resserre tout ce qui branle.',U&'\+01FA9B',200,null,1,'every_n_days',90,'household',null,'home_maintenance',174),
  ('tighten_screws','es','Apretar tornillos y manijas','Recorre la casa con un destornillador: manijas de gabinetes, bisagras de puertas, patas de sillas. Aprieta todo lo que se mueva.',U&'\+01FA9B',200,null,1,'every_n_days',90,'household',null,'home_maintenance',174),
  ('tighten_screws','pt','Apertar parafusos e puxadores',U&'Percorra a casa com uma chave de fenda: puxadores de arm\00E1rios, dobradi\00E7as de portas, p\00E9s de cadeiras. Aperte tudo o que estiver bambo.',U&'\+01FA9B',200,null,1,'every_n_days',90,'household',null,'home_maintenance',174)
on conflict (key, locale) do update set
  title = excluded.title, description = excluded.description, emoji = excluded.emoji, price_cents = excluded.price_cents,
  repeat_kind = excluded.repeat_kind, repeat_every_days = excluded.repeat_every_days, scope = excluded.scope,
  category = excluded.category, sort_order = excluded.sort_order;
