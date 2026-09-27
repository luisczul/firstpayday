-- Starter-chore copy fixes from the pre-launch language review (new households only;
-- chores already created keep their text). ASCII-only on purpose (non-ASCII as U& escapes).

-- es: neutral Latin American words ("interruptor", "mostrador", "frotar") instead of regional ones.
update public.chore_templates
   set title = 'Interruptores, manijas y controles',
       description = 'Limpia cada interruptor, manija de puerta y control remoto con limpiador.'
 where key = 'switches' and locale = 'es';

update public.chore_templates
   set description = U&'Frota las rejillas, vac\00EDa la bandeja de grasa, limpia el exterior y las mesitas laterales. Con un adulto cerca, y solo cuando est\00E9 fr\00EDa.'
 where key = 'barbecue' and locale = 'es';

update public.chore_templates
   set description = U&'Ayuda a preparar y cocinar una cena de principio a fin, y despu\00E9s limpia los mostradores.'
 where key = 'sous_chef' and locale = 'es';

update public.chore_templates
   set description = U&'Enc\00E1rgate de toda la ropa: separa, lava, seca, dobla y reparte en cada cuarto.'
 where key = 'laundry' and locale = 'es';

-- pt: "Fique pronto" is masculine; "Arrume-se" works for every kid.
update public.chore_templates t
   set subtasks = (
     select jsonb_agg(
              case when s->>'id' = 'ready' then jsonb_set(s, '{title}', to_jsonb('Arrume-se para a escola'::text)) else s end
              order by ord)
       from jsonb_array_elements(t.subtasks) with ordinality as e(s, ord)
   )
 where t.locale = 'pt' and t.key in ('daily_routine', 'morning_routine');
