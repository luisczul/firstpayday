-- Chores with subtasks (a checklist / routine).
--
-- A chore can carry up to 20 subtasks ({id, title, section?}). The kid ticks
-- them on the tablet during the chore's current period; only when every
-- subtask is ticked can the chore be submitted ("I did it!"), and then it
-- follows the normal review flow. Ticks are per kid and are keyed by the
-- chore's current availability period (period_key), so a daily routine
-- starts fresh the next local day. Rules mirror lib/schedule/getChoreState
-- (nextAvailableAt):
--   once          -> 'once'
--   daily         -> the local date (household timezone)
--   weekly        -> the local date the week started (households.week_starts_on)
--   every_n_days  -> anchor + k*n days, anchor = the day the chore became
--                    available (creation, or last relevant submission + n)
-- Writes to the ticks only go through kiosk_toggle_subtask (service role);
-- parents can read their own household's ticks.
-- A BEFORE INSERT trigger on submissions refuses a checklist chore unless
-- every current subtask is ticked for the current period, whatever path
-- inserts it (kiosk_create_submission today).
--
-- ASCII-only on purpose (non-ASCII written as U& escapes).

-- 1. Subtasks on chores and templates ---------------------------------------

create or replace function public.valid_subtasks(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'array' then false
    when jsonb_array_length(p) > 20 then false
    else not exists (
      select 1 from jsonb_array_elements(p) e
       where jsonb_typeof(e) <> 'object'
          or jsonb_typeof(e->'id') is distinct from 'string'
          or (e->>'id') !~ '^[A-Za-z0-9_-]{1,40}$'
          or jsonb_typeof(e->'title') is distinct from 'string'
          or char_length(btrim(e->>'title')) not between 1 and 80
          or (e ? 'section' and jsonb_typeof(e->'section') not in ('string', 'null'))
          or char_length(coalesce(e->>'section', '')) > 40
    ) and (select count(distinct e->>'id') from jsonb_array_elements(p) e) = jsonb_array_length(p)
  end
$$;

alter table public.chores
  add column if not exists subtasks jsonb not null default '[]'::jsonb;
alter table public.chores
  add constraint chores_subtasks_valid check (public.valid_subtasks(subtasks));

alter table public.chore_templates
  add column if not exists subtasks jsonb not null default '[]'::jsonb;
alter table public.chore_templates
  add constraint chore_templates_subtasks_valid check (public.valid_subtasks(subtasks));

-- 2. Ticks ------------------------------------------------------------------

create table public.chore_subtask_checks (
  household_id uuid not null references public.households(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  chore_id uuid not null references public.chores(id) on delete cascade,
  subtask_id text not null check (subtask_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  period_key text not null check (char_length(period_key) between 1 and 20),
  checked_at timestamptz not null default now(),
  device_id uuid references public.devices(id) on delete set null,
  primary key (kid_id, chore_id, period_key, subtask_id)
);
create index chore_subtask_checks_chore_idx on public.chore_subtask_checks (chore_id);
create index chore_subtask_checks_household_idx on public.chore_subtask_checks (household_id, kid_id);
create index chore_subtask_checks_device_idx on public.chore_subtask_checks (device_id);

create or replace function public.chore_subtask_checks_same_household()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.chores c where c.id = new.chore_id and c.household_id = new.household_id) then
    raise exception 'chore does not belong to household';
  end if;
  if not exists (select 1 from public.kids k where k.id = new.kid_id and k.household_id = new.household_id) then
    raise exception 'kid does not belong to household';
  end if;
  return new;
end $$;

create trigger chore_subtask_checks_same_household before insert or update
  on public.chore_subtask_checks for each row execute function public.chore_subtask_checks_same_household();

alter table public.chore_subtask_checks enable row level security;
create policy chore_subtask_checks_select on public.chore_subtask_checks for select to authenticated
  using (public.is_member(household_id));
-- No insert/update/delete policies: the kiosk writes with the service role.
revoke insert, update, delete, truncate on public.chore_subtask_checks from authenticated, anon;

-- 3. The current period of a checklist chore for a kid -------------------------

create or replace function public.checklist_period_key(p_chore_id uuid, p_kid_id uuid, p_at timestamptz)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_chore public.chores;
  v_tz text;
  v_wso int;
  v_today date;
  v_anchor date;
  v_latest timestamptz;
  v_n int;
begin
  select * into v_chore from public.chores where id = p_chore_id;
  if not found then
    return null;
  end if;
  select h.timezone, h.week_starts_on into v_tz, v_wso from public.households h where h.id = v_chore.household_id;
  v_today := (p_at at time zone v_tz)::date;
  if v_chore.repeat_kind = 'once' then
    return 'once';
  elsif v_chore.repeat_kind = 'daily' then
    return to_char(v_today, 'YYYY-MM-DD');
  elsif v_chore.repeat_kind = 'weekly' then
    return to_char(v_today - ((extract(dow from v_today)::int - v_wso + 7) % 7), 'YYYY-MM-DD');
  end if;
  -- every_n_days: count n-day periods from when the chore became available.
  v_n := greatest(1, coalesce(v_chore.repeat_every_days, 1));
  select max(s.submitted_at) into v_latest from public.submissions s
   where s.chore_id = v_chore.id and (v_chore.scope = 'household' or s.kid_id = p_kid_id);
  v_anchor := (v_chore.created_at at time zone v_tz)::date;
  if v_latest is not null then
    v_anchor := greatest(v_anchor, (v_latest at time zone v_tz)::date + v_n);
  end if;
  return to_char(v_anchor + (greatest(0, v_today - v_anchor) / v_n) * v_n, 'YYYY-MM-DD');
end $$;

-- 4. Kiosk: tick / untick one subtask, and read a kid's progress -------------

create or replace function public.kiosk_toggle_subtask(
  p_household_id uuid, p_kid_id uuid, p_chore_id uuid, p_subtask_id text, p_checked boolean, p_device_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_chore public.chores;
  v_key text;
  v_checked jsonb;
begin
  if not public.household_has_full_access(p_household_id) then
    raise exception 'board_paused' using errcode = '42501';
  end if;
  select * into v_chore from public.chores
   where id = p_chore_id and household_id = p_household_id and active;
  if not found then
    raise exception 'chore_unavailable' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.kids k where k.id = p_kid_id and k.household_id = p_household_id and k.archived_at is null) then
    raise exception 'kid_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.chore_assignees a where a.chore_id = p_chore_id)
     and not exists (select 1 from public.chore_assignees a where a.chore_id = p_chore_id and a.kid_id = p_kid_id) then
    raise exception 'kid_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_chore.subtasks) e where e->>'id' = p_subtask_id) then
    raise exception 'subtask_not_found' using errcode = 'P0002';
  end if;

  v_key := public.checklist_period_key(p_chore_id, p_kid_id, now());
  -- Ticks from earlier periods are not needed any more.
  delete from public.chore_subtask_checks
   where kid_id = p_kid_id and chore_id = p_chore_id and period_key <> v_key;
  if p_checked then
    insert into public.chore_subtask_checks (household_id, kid_id, chore_id, subtask_id, period_key, device_id)
    values (p_household_id, p_kid_id, p_chore_id, p_subtask_id, v_key, p_device_id)
    on conflict (kid_id, chore_id, period_key, subtask_id) do nothing;
  else
    delete from public.chore_subtask_checks
     where kid_id = p_kid_id and chore_id = p_chore_id and period_key = v_key and subtask_id = p_subtask_id;
  end if;

  select coalesce(jsonb_agg(c.subtask_id order by c.checked_at, c.subtask_id), '[]'::jsonb) into v_checked
    from public.chore_subtask_checks c
   where c.kid_id = p_kid_id and c.chore_id = p_chore_id and c.period_key = v_key;
  return jsonb_build_object('period_key', v_key, 'checked', v_checked);
end $$;

-- {chore_id: {"period_key": ..., "checked": [subtask ids]}} for every active checklist chore.
create or replace function public.kiosk_checklist_progress(p_household_id uuid, p_kid_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(c.id::text, jsonb_build_object(
    'period_key', k.key,
    'checked', coalesce((
      select jsonb_agg(x.subtask_id order by x.checked_at, x.subtask_id)
        from public.chore_subtask_checks x
       where x.kid_id = p_kid_id and x.chore_id = c.id and x.period_key = k.key), '[]'::jsonb)
  )), '{}'::jsonb)
  from public.chores c
  cross join lateral (select public.checklist_period_key(c.id, p_kid_id, now()) as key) k
  where c.household_id = p_household_id
    and c.active
    and jsonb_array_length(c.subtasks) > 0
    and exists (select 1 from public.kids kd where kd.id = p_kid_id and kd.household_id = p_household_id)
$$;

-- 5. A checklist chore can't be submitted until every subtask is ticked ---------

create or replace function public.submissions_require_checklist()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_chore public.chores;
  v_key text;
begin
  select * into v_chore from public.chores where id = new.chore_id;
  if not found or jsonb_array_length(v_chore.subtasks) = 0 then
    return new;
  end if;
  v_key := public.checklist_period_key(new.chore_id, new.kid_id, now());
  if exists (
    select 1 from jsonb_array_elements(v_chore.subtasks) e
     where not exists (
       select 1 from public.chore_subtask_checks c
        where c.kid_id = new.kid_id and c.chore_id = new.chore_id
          and c.period_key = v_key and c.subtask_id = e->>'id')
  ) then
    raise exception 'checklist_incomplete' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger submissions_require_checklist before insert on public.submissions
  for each row execute function public.submissions_require_checklist();

revoke execute on function public.checklist_period_key(uuid, uuid, timestamptz),
  public.kiosk_toggle_subtask(uuid, uuid, uuid, text, boolean, uuid),
  public.kiosk_checklist_progress(uuid, uuid),
  public.submissions_require_checklist() from anon, authenticated, public;
grant execute on function public.checklist_period_key(uuid, uuid, timestamptz),
  public.kiosk_toggle_subtask(uuid, uuid, uuid, text, boolean, uuid),
  public.kiosk_checklist_progress(uuid, uuid) to service_role;

-- 6. Routine templates: $0.10 a day, each kid on their own ------------------
-- Daily routine has sections (morning / afternoon / evening); the morning
-- and evening routines are plain lists. Subtask ids match across languages.

insert into public.chore_templates
  (key, locale, title, description, emoji, price_cents, unit_label, max_quantity, repeat_kind, repeat_every_days, scope, season, category, sort_order, subtasks)
values
  ('daily_routine','en','Daily routine','Tick each step through the day. When they''re all done, tap I did it!',U&'\+01F31E',10,null,1,'daily',null,'per_kid',null,'organizing',1,
   U&'[{"id":"teeth","title":"Brush your teeth","section":"\+01F305 Morning"},{"id":"breakfast","title":"Eat your breakfast","section":"\+01F305 Morning"},{"id":"backpack","title":"Pack your backpack","section":"\+01F305 Morning"},{"id":"table","title":"Clean your table","section":"\+01F305 Morning"},{"id":"ready","title":"Get ready for school","section":"\+01F305 Morning"},{"id":"lunch","title":"Eat your lunch","section":"\2600\FE0F Afternoon"},{"id":"nap","title":"Nap time","section":"\2600\FE0F Afternoon"},{"id":"study","title":"Study time","section":"\2600\FE0F Afternoon"},{"id":"exercise","title":"Exercise","section":"\2600\FE0F Afternoon"},{"id":"dishes","title":"Do the dishes","section":"\+01F319 Evening"},{"id":"homework","title":"Do your homework","section":"\+01F319 Evening"},{"id":"play","title":"Playtime","section":"\+01F319 Evening"},{"id":"bath","title":"Take a bath","section":"\+01F319 Evening"},{"id":"pajamas","title":"Put on your pajamas","section":"\+01F319 Evening"}]'::jsonb),
  ('daily_routine','fr',U&'Routine de la journ\00E9e',U&'Coche chaque \00E9tape pendant la journ\00E9e. Quand tout est fait, appuie sur Je l''ai fait!',U&'\+01F31E',10,null,1,'daily',null,'per_kid',null,'organizing',1,
   U&'[{"id":"teeth","title":"Brosse-toi les dents","section":"\+01F305 Matin"},{"id":"breakfast","title":"Mange ton d\00E9jeuner","section":"\+01F305 Matin"},{"id":"backpack","title":"Pr\00E9pare ton sac d''\00E9cole","section":"\+01F305 Matin"},{"id":"table","title":"Nettoie ta table","section":"\+01F305 Matin"},{"id":"ready","title":"Pr\00E9pare-toi pour l''\00E9cole","section":"\+01F305 Matin"},{"id":"lunch","title":"Mange ton d\00EEner","section":"\2600\FE0F Apr\00E8s-midi"},{"id":"nap","title":"L''heure de la sieste","section":"\2600\FE0F Apr\00E8s-midi"},{"id":"study","title":"L''heure d''\00E9tudier","section":"\2600\FE0F Apr\00E8s-midi"},{"id":"exercise","title":"Fais de l''exercice","section":"\2600\FE0F Apr\00E8s-midi"},{"id":"dishes","title":"Fais la vaisselle","section":"\+01F319 Soir"},{"id":"homework","title":"Fais tes devoirs","section":"\+01F319 Soir"},{"id":"play","title":"Temps de jeu","section":"\+01F319 Soir"},{"id":"bath","title":"Prends ton bain","section":"\+01F319 Soir"},{"id":"pajamas","title":"Mets ton pyjama","section":"\+01F319 Soir"}]'::jsonb),
  ('daily_routine','es',U&'Rutina del d\00EDa',U&'Marca cada paso durante el d\00EDa. Cuando termines todos, toca \00A1Lo hice!',U&'\+01F31E',10,null,1,'daily',null,'per_kid',null,'organizing',1,
   U&'[{"id":"teeth","title":"Cep\00EDllate los dientes","section":"\+01F305 Ma\00F1ana"},{"id":"breakfast","title":"Toma tu desayuno","section":"\+01F305 Ma\00F1ana"},{"id":"backpack","title":"Prepara tu mochila","section":"\+01F305 Ma\00F1ana"},{"id":"table","title":"Limpia tu mesa","section":"\+01F305 Ma\00F1ana"},{"id":"ready","title":"Al\00EDstate para la escuela","section":"\+01F305 Ma\00F1ana"},{"id":"lunch","title":"Come tu almuerzo","section":"\2600\FE0F Tarde"},{"id":"nap","title":"Hora de la siesta","section":"\2600\FE0F Tarde"},{"id":"study","title":"Hora de estudiar","section":"\2600\FE0F Tarde"},{"id":"exercise","title":"Haz ejercicio","section":"\2600\FE0F Tarde"},{"id":"dishes","title":"Lava los platos","section":"\+01F319 Noche"},{"id":"homework","title":"Haz tu tarea","section":"\+01F319 Noche"},{"id":"play","title":"Hora de jugar","section":"\+01F319 Noche"},{"id":"bath","title":"B\00E1\00F1ate","section":"\+01F319 Noche"},{"id":"pajamas","title":"Ponte la pijama","section":"\+01F319 Noche"}]'::jsonb),
  ('daily_routine','pt','Rotina do dia','Marque cada passo ao longo do dia. Quando terminar todos, toque em Eu fiz!',U&'\+01F31E',10,null,1,'daily',null,'per_kid',null,'organizing',1,
   U&'[{"id":"teeth","title":"Escove os dentes","section":"\+01F305 Manh\00E3"},{"id":"breakfast","title":"Tome o caf\00E9 da manh\00E3","section":"\+01F305 Manh\00E3"},{"id":"backpack","title":"Arrume sua mochila","section":"\+01F305 Manh\00E3"},{"id":"table","title":"Limpe sua mesa","section":"\+01F305 Manh\00E3"},{"id":"ready","title":"Fique pronto para a escola","section":"\+01F305 Manh\00E3"},{"id":"lunch","title":"Coma seu almo\00E7o","section":"\2600\FE0F Tarde"},{"id":"nap","title":"Hora da soneca","section":"\2600\FE0F Tarde"},{"id":"study","title":"Hora de estudar","section":"\2600\FE0F Tarde"},{"id":"exercise","title":"Fa\00E7a exerc\00EDcio","section":"\2600\FE0F Tarde"},{"id":"dishes","title":"Lave a lou\00E7a","section":"\+01F319 Noite"},{"id":"homework","title":"Fa\00E7a sua li\00E7\00E3o de casa","section":"\+01F319 Noite"},{"id":"play","title":"Hora de brincar","section":"\+01F319 Noite"},{"id":"bath","title":"Tome banho","section":"\+01F319 Noite"},{"id":"pajamas","title":"Vista o pijama","section":"\+01F319 Noite"}]'::jsonb),
  ('morning_routine','en','Morning routine','Tick each step as you go. When they''re all done, tap I did it!',U&'\+01F305',10,null,1,'daily',null,'per_kid',null,'organizing',2,
   '[{"id":"teeth","title":"Brush your teeth"},{"id":"breakfast","title":"Eat your breakfast"},{"id":"backpack","title":"Pack your backpack"},{"id":"table","title":"Clean your table"},{"id":"ready","title":"Get ready for school"}]'::jsonb),
  ('morning_routine','fr','Routine du matin',U&'Coche chaque \00E9tape au fur et \00E0 mesure. Quand tout est fait, appuie sur Je l''ai fait!',U&'\+01F305',10,null,1,'daily',null,'per_kid',null,'organizing',2,
   U&'[{"id":"teeth","title":"Brosse-toi les dents"},{"id":"breakfast","title":"Mange ton d\00E9jeuner"},{"id":"backpack","title":"Pr\00E9pare ton sac d''\00E9cole"},{"id":"table","title":"Nettoie ta table"},{"id":"ready","title":"Pr\00E9pare-toi pour l''\00E9cole"}]'::jsonb),
  ('morning_routine','es',U&'Rutina de la ma\00F1ana',U&'Marca cada paso cuando lo hagas. Cuando termines todos, toca \00A1Lo hice!',U&'\+01F305',10,null,1,'daily',null,'per_kid',null,'organizing',2,
   U&'[{"id":"teeth","title":"Cep\00EDllate los dientes"},{"id":"breakfast","title":"Toma tu desayuno"},{"id":"backpack","title":"Prepara tu mochila"},{"id":"table","title":"Limpia tu mesa"},{"id":"ready","title":"Al\00EDstate para la escuela"}]'::jsonb),
  ('morning_routine','pt',U&'Rotina da manh\00E3','Marque cada passo quando fizer. Quando terminar todos, toque em Eu fiz!',U&'\+01F305',10,null,1,'daily',null,'per_kid',null,'organizing',2,
   U&'[{"id":"teeth","title":"Escove os dentes"},{"id":"breakfast","title":"Tome o caf\00E9 da manh\00E3"},{"id":"backpack","title":"Arrume sua mochila"},{"id":"table","title":"Limpe sua mesa"},{"id":"ready","title":"Fique pronto para a escola"}]'::jsonb),
  ('evening_routine','en','Evening routine','Tick each step as you go. When they''re all done, tap I did it!',U&'\+01F319',10,null,1,'daily',null,'per_kid',null,'organizing',3,
   '[{"id":"dishes","title":"Do the dishes"},{"id":"homework","title":"Do your homework"},{"id":"play","title":"Have some playtime"},{"id":"bath","title":"Take a bath"},{"id":"pajamas","title":"Put on your pajamas"},{"id":"story","title":"Story time"}]'::jsonb),
  ('evening_routine','fr','Routine du soir',U&'Coche chaque \00E9tape au fur et \00E0 mesure. Quand tout est fait, appuie sur Je l''ai fait!',U&'\+01F319',10,null,1,'daily',null,'per_kid',null,'organizing',3,
   '[{"id":"dishes","title":"Fais la vaisselle"},{"id":"homework","title":"Fais tes devoirs"},{"id":"play","title":"Prends du temps pour jouer"},{"id":"bath","title":"Prends ton bain"},{"id":"pajamas","title":"Mets ton pyjama"},{"id":"story","title":"L''heure du conte"}]'::jsonb),
  ('evening_routine','es','Rutina de la noche',U&'Marca cada paso cuando lo hagas. Cuando termines todos, toca \00A1Lo hice!',U&'\+01F319',10,null,1,'daily',null,'per_kid',null,'organizing',3,
   U&'[{"id":"dishes","title":"Lava los platos"},{"id":"homework","title":"Haz tu tarea"},{"id":"play","title":"Juega un rato"},{"id":"bath","title":"B\00E1\00F1ate"},{"id":"pajamas","title":"Ponte la pijama"},{"id":"story","title":"Hora del cuento"}]'::jsonb),
  ('evening_routine','pt','Rotina da noite','Marque cada passo quando fizer. Quando terminar todos, toque em Eu fiz!',U&'\+01F319',10,null,1,'daily',null,'per_kid',null,'organizing',3,
   U&'[{"id":"dishes","title":"Lave a lou\00E7a"},{"id":"homework","title":"Fa\00E7a sua li\00E7\00E3o de casa"},{"id":"play","title":"Brinque um pouco"},{"id":"bath","title":"Tome banho"},{"id":"pajamas","title":"Vista o pijama"},{"id":"story","title":"Hora da historinha"}]'::jsonb)

on conflict (key, locale) do update set
  title = excluded.title, description = excluded.description, emoji = excluded.emoji, price_cents = excluded.price_cents,
  unit_label = excluded.unit_label, max_quantity = excluded.max_quantity, repeat_kind = excluded.repeat_kind,
  repeat_every_days = excluded.repeat_every_days, scope = excluded.scope, season = excluded.season,
  category = excluded.category, sort_order = excluded.sort_order, subtasks = excluded.subtasks;
