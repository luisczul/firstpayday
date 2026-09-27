-- Spanish (es) and Brazilian Portuguese (pt) join English and French.
-- ASCII-only on purpose (accents written as U& escapes) so it survives being
-- pasted into the Supabase SQL editor.

-- 1. Allow the new locales wherever a language is stored.
alter table public.households drop constraint if exists households_locale_check;
alter table public.households add constraint households_locale_check check (locale in ('en','fr','es','pt'));

alter table public.kids drop constraint if exists kids_locale_check;
alter table public.kids add constraint kids_locale_check check (locale is null or locale in ('en','fr','es','pt'));

alter table public.chore_templates drop constraint if exists chore_templates_locale_check;
alter table public.chore_templates add constraint chore_templates_locale_check check (locale in ('en','fr','es','pt'));

-- 2. Spanish and Portuguese starter templates. Price, emoji, repeat, scope,
-- season, category and order come from the English row, so they always match.
insert into public.chore_templates
  (key, locale, title, description, emoji, price_cents, unit_label, max_quantity, repeat_kind, repeat_every_days, scope, season, category, sort_order)
select en.key, v.locale, v.title, v.description, en.emoji, en.price_cents, v.unit_label, en.max_quantity,
       en.repeat_kind, en.repeat_every_days, en.scope, en.season, en.category, en.sort_order
from (values
  ('make_bed','es','Tiende tu cama',U&'Estira las s\00E1banas y la cobija, esponja la almohada y vuelve a poner los peluches en su lugar.',null),
  ('make_bed','pt','Arrume sua cama',U&'Estique o len\00E7ol e o cobertor, afofe o travesseiro e coloque os bichinhos de pel\00FAcia de volta no lugar.',null),
  ('car_mats','es','Tapetes del auto y aspiradora',U&'Saca todos los tapetes del auto, aspira el auto, limpia los tapetes a la perfecci\00F3n y vuelve a ponerlos.',null),
  ('car_mats','pt','Tapetes do carro e aspirador','Tire todos os tapetes do carro, aspire o carro, limpe os tapetes direitinho e coloque de volta.',null),
  ('garage_sweep','es','Barrer el garaje','Barre y limpia todo el piso del garaje.',null),
  ('garage_sweep','pt','Varrer a garagem',U&'Varra e limpe todo o ch\00E3o da garagem.',null),
  ('summer_wrapup','es','Guardar el verano',U&'Baja la ropa de verano, lleva los muebles de exterior frente a la caba\00F1a y alinea frente al garaje todo lo que va dentro del garaje.',null),
  ('summer_wrapup','pt',U&'Guardar as coisas do ver\00E3o',U&'Des\00E7a as roupas de ver\00E3o, leve os m\00F3veis da \00E1rea externa para a frente da cabana e enfileire na frente da garagem tudo o que vai para dentro dela.',null),
  ('garden_closedown','es',U&'Cerrar el jard\00EDn',U&'Arranca las plantas que ya terminaron, vac\00EDa las macetas y ap\00EDlalas en el cobertizo.',null),
  ('garden_closedown','pt','Fechar o jardim',U&'Arranque as plantas que j\00E1 acabaram, esvazie os vasos e empilhe tudo no galp\00E3o.',null),
  ('terrace','es','Limpiar la terraza al 100 %','Barre, lava y despeja toda la terraza hasta que quede reluciente. Muebles limpios y nada tirado.',null),
  ('terrace','pt',U&'Limpar o terra\00E7o 100%',U&'Varra, lave e arrume o terra\00E7o inteiro at\00E9 ficar brilhando. M\00F3veis limpos e nada jogado por a\00ED.',null),
  ('barbecue','es','Limpiar la parrilla al 100 %',U&'Talla las rejillas, vac\00EDa la bandeja de grasa, limpia el exterior y las mesitas laterales. Con un adulto cerca, y solo cuando est\00E9 fr\00EDa.',null),
  ('barbecue','pt','Limpar a churrasqueira 100%',U&'Esfregue as grelhas, esvazie a bandeja de gordura, limpe a parte de fora e as mesinhas laterais. Com um adulto por perto, e s\00F3 quando estiver fria.',null),
  ('kitchen_cabinets','es','Gabinetes de la cocina','Limpia cada gabinete de la cocina, las puertas y las manijas.',null),
  ('kitchen_cabinets','pt',U&'Arm\00E1rios da cozinha',U&'Limpe cada arm\00E1rio da cozinha, as portas e os puxadores.',null),
  ('sous_chef','es','Noche de ayudante de chef',U&'Ayuda a preparar y cocinar una cena de principio a fin, y despu\00E9s limpia las encimeras.',null),
  ('sous_chef','pt','Noite de ajudante de chef',U&'Ajude a preparar e cozinhar um jantar do come\00E7o ao fim e depois limpe as bancadas.',null),
  ('bathroom_deep','es',U&'Limpieza profunda del ba\00F1o','Espejo, lavabo, inodoro, piso y toallas limpias en su lugar.',null),
  ('bathroom_deep','pt','Faxina completa do banheiro',U&'Espelho, pia, vaso sanit\00E1rio, ch\00E3o e toalhas limpas no lugar.',null),
  ('bin_boss','es','Jefe de la basura',U&'Vac\00EDa todos los botes de basura de la casa y saca la basura y el reciclaje a la calle.',null),
  ('bin_boss','pt','Chefe do lixo',U&'Esvazie todas as lixeiras da casa e leve o lixo e o recicl\00E1vel para a rua.',null),
  ('baseboards','es',U&'Z\00F3calos',U&'Toma una toalla mojada y limpia cada z\00F3calo del piso.','piso'),
  ('baseboards','pt',U&'Rodap\00E9s',U&'Pegue uma toalha molhada e limpe cada rodap\00E9 do andar.','andar'),
  ('switches','es','Apagadores, manijas y controles','Limpia cada apagador, manija de puerta y control remoto con limpiador.','piso'),
  ('switches','pt',U&'Interruptores, ma\00E7anetas e controles',U&'Limpe cada interruptor, ma\00E7aneta e controle remoto com produto de limpeza.','andar'),
  ('laundry','es','Encargado de la ropa','Lava toda la ropa: separa, lava, seca, dobla y reparte en cada cuarto.',null),
  ('laundry','pt',U&'Respons\00E1vel pela roupa','Cuide de toda a roupa: separe, lave, seque, dobre e entregue em cada quarto.',null),
  ('shoe_station','es',U&'Rinc\00F3n de los zapatos','Ordena cada zapato y cada bota de la entrada, bien alineados.',null),
  ('shoe_station','pt','Cantinho dos sapatos','Organize cada sapato e cada bota da entrada, tudo bem alinhado.',null),
  ('closet_swap','es',U&'Cambio de cl\00F3set para el invierno','Guarda la ropa de verano en cajas, saca los abrigos y las botas, y pon lo que ya no te queda en la bolsa para donar.',null),
  ('closet_swap','pt','Troca do guarda-roupa de inverno',U&'Guarde as roupas de ver\00E3o em caixas, tire os casacos e as botas e coloque o que n\00E3o serve mais na sacola de doa\00E7\00E3o.',null),
  ('basement_toys','es',U&'Revisi\00F3n de juguetes del s\00F3tano',U&'Recorre todo el s\00F3tano, decide qu\00E9 juguetes regalamos y cu\00E1les guardamos, y ordena todo por categor\00EDa.',null),
  ('basement_toys','pt',U&'Revis\00E3o dos brinquedos do por\00E3o',U&'Passe pelo por\00E3o inteiro, decida quais brinquedos vamos doar e quais vamos guardar, e organize tudo por categoria.',null)
) as v(key, locale, title, description, unit_label)
join public.chore_templates en on en.key = v.key and en.locale = 'en'
on conflict (key, locale) do update set
  title = excluded.title, description = excluded.description, emoji = excluded.emoji, price_cents = excluded.price_cents,
  unit_label = excluded.unit_label, max_quantity = excluded.max_quantity, repeat_kind = excluded.repeat_kind,
  repeat_every_days = excluded.repeat_every_days, scope = excluded.scope, season = excluded.season,
  category = excluded.category, sort_order = excluded.sort_order;
