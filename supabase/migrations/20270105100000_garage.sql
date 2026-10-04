-- Kumani Garage (piano Base): le proprie auto, di proprietà o a noleggio.
-- - Noleggio a lungo termine: contratto (mesi, km inclusi, rata, costo dei
--   km in più) e rilevazioni dei km per sapere se si è nel budget.
-- - Scadenze (bollo, assicurazione, revisione, tagliando, gomme): nell'agenda
--   della Home e nei promemoria push.
-- - Spese dell'auto: copiate anche tra le spese variabili di Spendly (se
--   l'utente può usarlo); la rata del noleggio tra le spese fisse.

insert into public.marketplace_settings (tool_name, is_enabled, description, required_plan)
values ('garage', true, 'Kumani Garage – auto di proprietà e a noleggio: controllo km, scadenze e spese. Spento: il servizio non è disponibile', 'base')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('garage', 'Kumani Garage', 1, 10)
on conflict (key) do nothing;

-- Veicoli
create table if not exists public.garage_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('owned', 'rental')),
  name text not null check (char_length(name) between 1 and 60),
  model text check (model is null or char_length(model) <= 80),
  plate text check (plate is null or char_length(plate) <= 15),
  -- Km segnati quando si inizia a seguire l'auto (al ritiro, per il noleggio)
  initial_km integer not null default 0 check (initial_km between 0 and 2000000),
  -- Noleggio a lungo termine
  rental_start date,
  rental_months integer check (rental_months is null or rental_months between 1 and 120),
  rental_km_included integer check (rental_km_included is null or rental_km_included between 1 and 2000000),
  rental_monthly_fee numeric(10,2) check (rental_monthly_fee is null or rental_monthly_fee >= 0),
  rental_down_payment numeric(10,2) check (rental_down_payment is null or rental_down_payment >= 0),
  rental_extra_km_cost numeric(8,4) check (rental_extra_km_cost is null or rental_extra_km_cost >= 0),
  rental_unused_km_refund numeric(8,4) check (rental_unused_km_refund is null or rental_unused_km_refund >= 0),
  rental_includes_tax boolean not null default true,
  rental_includes_insurance boolean not null default true,
  -- Rata del noleggio tra le spese fisse di Spendly
  spendly_fixed_id uuid references public.spendly_fixed_expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint garage_rental_fields check (
    kind = 'owned' or (rental_start is not null and rental_months is not null and rental_km_included is not null)
  )
);
create index if not exists garage_vehicles_user_idx on public.garage_vehicles (user_id, created_at);

-- Rilevazioni dei km (contachilometri)
create table if not exists public.garage_readings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  km integer not null check (km between 0 and 2000000),
  read_on date not null,
  note text check (note is null or char_length(note) <= 120),
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, user_id) references public.garage_vehicles(id, user_id) on delete cascade
);
create index if not exists garage_readings_vehicle_idx on public.garage_readings (vehicle_id, read_on);

-- Scadenze dell'auto
create table if not exists public.garage_deadlines (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bollo', 'assicurazione', 'revisione', 'tagliando', 'gomme', 'altro')),
  title text check (title is null or char_length(title) <= 80),
  due_date date not null,
  amount numeric(10,2) check (amount is null or amount >= 0),
  recurrence text not null default 'yearly' check (recurrence in ('none', 'yearly', 'every_2_years')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vehicle_id, user_id) references public.garage_vehicles(id, user_id) on delete cascade
);
create index if not exists garage_deadlines_user_idx on public.garage_deadlines (user_id, due_date);
create index if not exists garage_deadlines_vehicle_idx on public.garage_deadlines (vehicle_id, due_date);

-- Spese dell'auto (copiate in Spendly come spese variabili)
create table if not exists public.garage_expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('carburante', 'manutenzione', 'bollo', 'assicurazione', 'revisione', 'gomme', 'pedaggi', 'parcheggio', 'lavaggio', 'altro')),
  amount numeric(10,2) not null check (amount >= 0 and amount <= 1000000),
  spent_on date not null,
  note text check (note is null or char_length(note) <= 120),
  spendly_expense_id uuid references public.spendly_variable_expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, user_id) references public.garage_vehicles(id, user_id) on delete cascade
);
create index if not exists garage_expenses_vehicle_idx on public.garage_expenses (vehicle_id, spent_on desc);

-- Solo i propri dati; scrivere solo con il piano che include Garage
-- (leggere e cancellare restano possibili anche dopo)
do $$
declare
  t text;
begin
  foreach t in array array['garage_vehicles', 'garage_readings', 'garage_deadlines', 'garage_expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_plan_insert', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (exists (select 1 from public.can_use_tool(''garage'') x where x.allowed))', t || '_plan_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_plan_update', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (exists (select 1 from public.can_use_tool(''garage'') x where x.allowed))', t || '_plan_update', t);
  end loop;
end;
$$;

-- Limiti per utente
create or replace function public.garage_limits_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'garage_vehicles' and (select count(*) from public.garage_vehicles where user_id = new.user_id) >= 10 then
    raise exception 'garage_vehicles_limit';
  end if;
  if tg_table_name = 'garage_readings' and (select count(*) from public.garage_readings where user_id = new.user_id) >= 2000 then
    raise exception 'garage_readings_limit';
  end if;
  if tg_table_name = 'garage_deadlines' and (select count(*) from public.garage_deadlines where user_id = new.user_id) >= 200 then
    raise exception 'garage_deadlines_limit';
  end if;
  if tg_table_name = 'garage_expenses' and (select count(*) from public.garage_expenses where user_id = new.user_id) >= 5000 then
    raise exception 'garage_expenses_limit';
  end if;
  return new;
end;
$$;
revoke all on function public.garage_limits_check() from public, anon, authenticated;

drop trigger if exists garage_vehicles_limit on public.garage_vehicles;
create trigger garage_vehicles_limit before insert on public.garage_vehicles for each row execute function public.garage_limits_check();
drop trigger if exists garage_readings_limit on public.garage_readings;
create trigger garage_readings_limit before insert on public.garage_readings for each row execute function public.garage_limits_check();
drop trigger if exists garage_deadlines_limit on public.garage_deadlines;
create trigger garage_deadlines_limit before insert on public.garage_deadlines for each row execute function public.garage_limits_check();
drop trigger if exists garage_expenses_limit on public.garage_expenses;
create trigger garage_expenses_limit before insert on public.garage_expenses for each row execute function public.garage_limits_check();

-- Cancellazione dell'account (GDPR): via auto, km, scadenze e spese
create or replace function public.garage_profile_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.garage_vehicles where user_id = new.id;
  return new;
end;
$$;
revoke all on function public.garage_profile_deleted_cleanup() from public, anon, authenticated;

drop trigger if exists garage_profile_deleted_cleanup on public.profiles;
create trigger garage_profile_deleted_cleanup
  after update of deleted_at on public.profiles
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.garage_profile_deleted_cleanup();

-- KU Karma: stessa funzione di prima con 'garage' aggiunto all'elenco
CREATE OR REPLACE FUNCTION public.award_tool_point(p_tool_name text)
 RETURNS TABLE(awarded boolean, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_rows int;
  v_balance int;
  v_ku int;
begin
  if auth.uid() is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail', 'oxygen',
    'documento-sicuro', 'verifica-iban', 'firma-email', 'calcolatrici', 'focus',
    'landing-page', 'garage'
  ) then
    return;
  end if;

  -- Niente punti per strumenti non inclusi nel piano (evita di raccogliere
  -- KU chiamando la funzione direttamente senza usare lo strumento).
  if not exists (select 1 from public.tool_access(auth.uid(), p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (auth.uid(), p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  v_ku := public.ku_points_for(p_tool_name);
  if v_rows = 0 or v_ku = 0 then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + v_ku,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
  where id = auth.uid()
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;
