-- REGISTRO ORE E TURNI (KUMANI Lavoro, piano Plus): chi lavora a ore
-- (camerieri, cuochi, commesse, magazzinieri, stagionali) segna i suoi turni
-- per controllare la busta paga. Ore ordinarie e straordinarie, domeniche,
-- festivi e notturne le calcola l'app (src/lib/registroOre.ts).
--
-- - Interruttore dell'Admin: spento (Solo Staff) finché lo Staff non lo
--   accende; piano Plus ('base').
-- - Ogni turno appartiene a un posto di lavoro della stessa persona: chiave
--   esterna doppia (place_id, user_id).
--
-- Orari: inizio e fine si salvano come istanti veri (timestamptz). La durata
-- è quindi sempre il tempo davvero passato, anche nelle notti del cambio
-- dell'ora: un turno 22:00–06:00 vale 9 ore la notte in cui si torna all'ora
-- solare e 7 ore quella in cui si passa all'ora legale. L'app trasforma il
-- «giorno + ora» scritto dall'utente nell'istante giusto con il fuso
-- Europe/Rome. La data del turno (work_date) è il giorno italiano in cui il
-- turno comincia e la scrive il database da solo: un turno 18:00–02:00 conta
-- nel giorno in cui è iniziato. ends_at vuoto = turno ancora in corso (uno solo
-- per persona).

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('registro-ore', false, true, 'base', 'Registro ore e turni – turni di lavoro, ore ordinarie e straordinarie, domeniche e festivi, stima del lordo, PDF del mese e CSV')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('registro-ore', 'Registro ore e turni', 1, 10)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Posti di lavoro

create table if not exists public.work_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text not null default '#c9a227' check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- Paga oraria lorda (facoltativa): serve solo alla stima del lordo
  hourly_rate numeric(8, 2) check (hourly_rate is null or (hourly_rate >= 0 and hourly_rate <= 1000)),
  -- Soglie delle ore ordinarie: oltre si conta straordinario
  daily_hours numeric(4, 2) not null default 8 check (daily_hours > 0 and daily_hours <= 24),
  weekly_hours numeric(5, 2) not null default 40 check (weekly_hours > 0 and weekly_hours <= 168),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Serve alla chiave esterna doppia dei turni
  constraint work_places_id_user_key unique (id, user_id)
);
create index if not exists idx_work_places_user on public.work_places(user_id, created_at);

-- ---------------------------------------------------------------------------
-- Turni

create table if not exists public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null,
  work_date date not null check (work_date between date '2000-01-01' and date '2100-12-31'),
  starts_at timestamptz not null,
  ends_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 720),
  is_holiday boolean not null default false,
  is_night boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Il turno deve appartenere a un posto di lavoro della stessa persona
  constraint work_shifts_place_owner_fkey foreign key (place_id, user_id)
    references public.work_places(id, user_id) on delete cascade,
  -- Fine dopo l'inizio, al massimo 24 ore, pausa più corta del turno
  constraint work_shifts_times_check check (
    ends_at is null
    or (ends_at > starts_at and ends_at - starts_at <= interval '24 hours'
        and make_interval(mins => break_minutes) < ends_at - starts_at)
  )
);
create index if not exists idx_work_shifts_user_date on public.work_shifts(user_id, work_date, starts_at);
create index if not exists idx_work_shifts_place on public.work_shifts(place_id);
-- Un solo turno «in corso» per persona
create unique index if not exists work_shifts_one_open on public.work_shifts(user_id) where ends_at is null;

-- ---------------------------------------------------------------------------
-- Sicurezza: ognuno vede e cambia solo i suoi dati; scrivere richiede il piano

alter table public.work_places enable row level security;
alter table public.work_shifts enable row level security;

drop policy if exists work_places_own_select on public.work_places;
create policy work_places_own_select on public.work_places for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists work_places_own_insert on public.work_places;
create policy work_places_own_insert on public.work_places for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists work_places_own_update on public.work_places;
create policy work_places_own_update on public.work_places for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists work_places_own_delete on public.work_places;
create policy work_places_own_delete on public.work_places for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists work_places_plan_insert on public.work_places;
create policy work_places_plan_insert on public.work_places as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('registro-ore') t where t.allowed));
drop policy if exists work_places_plan_update on public.work_places;
create policy work_places_plan_update on public.work_places as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('registro-ore') t where t.allowed));

drop policy if exists work_shifts_own_select on public.work_shifts;
create policy work_shifts_own_select on public.work_shifts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists work_shifts_own_insert on public.work_shifts;
create policy work_shifts_own_insert on public.work_shifts for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists work_shifts_own_update on public.work_shifts;
create policy work_shifts_own_update on public.work_shifts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists work_shifts_own_delete on public.work_shifts;
create policy work_shifts_own_delete on public.work_shifts for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists work_shifts_plan_insert on public.work_shifts;
create policy work_shifts_plan_insert on public.work_shifts as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('registro-ore') t where t.allowed));
drop policy if exists work_shifts_plan_update on public.work_shifts;
create policy work_shifts_plan_update on public.work_shifts as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('registro-ore') t where t.allowed));

-- ---------------------------------------------------------------------------
-- Data dell'ultima modifica; proprietario e data di creazione non cambiano

create or replace function public.work_places_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists work_places_touch on public.work_places;
create trigger work_places_touch before insert or update on public.work_places
  for each row execute function public.work_places_touch();

-- Giorno del turno = giorno italiano dell'inizio (con l'ora legale giusta)
create or replace function public.work_shifts_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.work_date := (new.starts_at at time zone 'Europe/Rome')::date;
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists work_shifts_touch on public.work_shifts;
create trigger work_shifts_touch before insert or update on public.work_shifts
  for each row execute function public.work_shifts_touch();

revoke execute on function public.work_places_touch() from public, anon, authenticated;
revoke execute on function public.work_shifts_touch() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Limiti per persona (modificabili dall'Admin → Limiti e pulizia)

insert into public.app_limits (key, value, kind, section, label, sort)
values
  ('work_places', 30, 'count', 'Registro ore e turni', 'Posti di lavoro per persona', 160),
  ('work_shifts', 10000, 'count', 'Registro ore e turni', 'Turni per persona', 161)
on conflict (key) do nothing;

drop trigger if exists app_limit_check on public.work_places;
create trigger app_limit_check before insert on public.work_places
  for each row execute function public.enforce_app_limit('work_places', 'user_id');
drop trigger if exists app_limit_check on public.work_shifts;
create trigger app_limit_check before insert on public.work_shifts
  for each row execute function public.enforce_app_limit('work_shifts', 'user_id');
