-- KUMANI Casa (piano Base), fase 1: le proprie case in un posto solo.
-- Non rifà ciò che esiste già:
-- - le scadenze della casa (manutenzioni, fine offerta, garanzie, documenti
--   che scadono) SONO voci di Life Calendar, collegate alla casa con
--   life_calendar_items.casa_home_id: compaiono in Life Calendar, nell'Agenda
--   e nei promemoria come tutte le altre;
-- - le bollette SONO spese fisse di Spendly (categoria bollette): l'utenza
--   tiene solo il collegamento (spendly_fixed_id).
-- Nuovo: case, utenze (fornitore, codici, assistenza), apparecchi con
-- garanzia e allegati, documenti della casa (bucket privato casa-files).

insert into public.marketplace_settings (tool_name, is_enabled, description, required_plan)
values ('casa', true, 'KUMANI Casa – le proprie case: scadenze e manutenzioni, utenze e bollette, apparecchi e garanzie, documenti. Spento: il servizio non è disponibile', 'base')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('casa', 'KUMANI Casa', 1, 10)
on conflict (key) do nothing;

-- Case
create table if not exists public.casa_homes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'main' check (kind in ('main', 'second', 'rented_out', 'other')),
  address text check (address is null or char_length(address) <= 160),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists casa_homes_user_idx on public.casa_homes (user_id, created_at);

-- Le scadenze della casa sono voci di Life Calendar (via la casa, via le voci)
alter table public.life_calendar_items
  add column if not exists casa_home_id uuid references public.casa_homes(id) on delete cascade;
create index if not exists life_calendar_items_casa_idx on public.life_calendar_items (casa_home_id) where casa_home_id is not null;

-- Utenze: luce, gas, acqua… (la bolletta sta in Spendly)
create table if not exists public.casa_utilities (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('electricity', 'gas', 'water', 'internet', 'phone', 'waste', 'heating', 'other')),
  provider text check (provider is null or char_length(provider) <= 80),
  customer_code text check (customer_code is null or char_length(customer_code) <= 60),
  -- POD (luce), PDR (gas), matricola del contatore…
  supply_code text check (supply_code is null or char_length(supply_code) <= 60),
  support_phone text check (support_phone is null or char_length(support_phone) <= 40),
  offer_ends_on date,
  notes text check (notes is null or char_length(notes) <= 500),
  spendly_fixed_id uuid references public.spendly_fixed_expenses(id) on delete set null,
  life_calendar_item_id uuid references public.life_calendar_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (home_id, user_id) references public.casa_homes(id, user_id) on delete cascade
);
create index if not exists casa_utilities_home_idx on public.casa_utilities (home_id, created_at);

-- Apparecchi ed elettrodomestici con la garanzia
create table if not exists public.casa_appliances (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  brand text check (brand is null or char_length(brand) <= 60),
  model text check (model is null or char_length(model) <= 80),
  serial_number text check (serial_number is null or char_length(serial_number) <= 80),
  room text check (room is null or char_length(room) <= 60),
  purchased_on date,
  price numeric(10,2) check (price is null or (price >= 0 and price <= 1000000)),
  store text check (store is null or char_length(store) <= 80),
  warranty_until date,
  support_phone text check (support_phone is null or char_length(support_phone) <= 40),
  notes text check (notes is null or char_length(notes) <= 500),
  -- Scontrino o fattura e manuale (bucket casa-files, cartella dell'utente)
  receipt_path text check (receipt_path is null or char_length(receipt_path) <= 300),
  manual_path text check (manual_path is null or char_length(manual_path) <= 300),
  life_calendar_item_id uuid references public.life_calendar_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (home_id, user_id) references public.casa_homes(id, user_id) on delete cascade
);
create index if not exists casa_appliances_home_idx on public.casa_appliances (home_id, name);

-- Documenti della casa
create table if not exists public.casa_documents (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lease', 'deed', 'insurance', 'systems', 'energy', 'floorplan', 'condo', 'other')),
  title text not null check (char_length(title) between 1 and 100),
  file_path text not null check (char_length(file_path) <= 300),
  file_name text check (file_name is null or char_length(file_name) <= 160),
  mime_type text check (mime_type is null or char_length(mime_type) <= 80),
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  expires_on date,
  life_calendar_item_id uuid references public.life_calendar_items(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (home_id, user_id) references public.casa_homes(id, user_id) on delete cascade
);
create index if not exists casa_documents_home_idx on public.casa_documents (home_id, created_at desc);
create index if not exists casa_documents_user_idx on public.casa_documents (user_id, created_at desc);

-- Solo i propri dati; scrivere solo con il piano che include Casa
-- (leggere e cancellare restano possibili anche dopo)
do $$
declare
  t text;
begin
  foreach t in array array['casa_homes', 'casa_utilities', 'casa_appliances', 'casa_documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_plan_insert', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (exists (select 1 from public.can_use_tool(''casa'') x where x.allowed))', t || '_plan_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_plan_update', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (exists (select 1 from public.can_use_tool(''casa'') x where x.allowed))', t || '_plan_update', t);
  end loop;
end;
$$;

-- Una voce di Life Calendar si collega solo a una casa propria
create or replace function public.life_calendar_casa_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.casa_home_id is not null
     and not exists (select 1 from public.casa_homes h where h.id = new.casa_home_id and h.user_id = new.user_id) then
    raise exception 'casa_home_not_owned';
  end if;
  return new;
end;
$$;
revoke all on function public.life_calendar_casa_check() from public, anon, authenticated;
drop trigger if exists life_calendar_casa_check on public.life_calendar_items;
create trigger life_calendar_casa_check before insert or update of casa_home_id on public.life_calendar_items
  for each row execute function public.life_calendar_casa_check();

-- Limiti per utente
create or replace function public.casa_limits_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'casa_homes' and (select count(*) from public.casa_homes where user_id = new.user_id) >= 5 then
    raise exception 'casa_homes_limit';
  end if;
  if tg_table_name = 'casa_utilities' and (select count(*) from public.casa_utilities where user_id = new.user_id) >= 50 then
    raise exception 'casa_utilities_limit';
  end if;
  if tg_table_name = 'casa_appliances' and (select count(*) from public.casa_appliances where user_id = new.user_id) >= 200 then
    raise exception 'casa_appliances_limit';
  end if;
  if tg_table_name = 'casa_documents' and (select count(*) from public.casa_documents where user_id = new.user_id) >= 300 then
    raise exception 'casa_documents_limit';
  end if;
  return new;
end;
$$;
revoke all on function public.casa_limits_check() from public, anon, authenticated;

drop trigger if exists casa_homes_limit on public.casa_homes;
create trigger casa_homes_limit before insert on public.casa_homes for each row execute function public.casa_limits_check();
drop trigger if exists casa_utilities_limit on public.casa_utilities;
create trigger casa_utilities_limit before insert on public.casa_utilities for each row execute function public.casa_limits_check();
drop trigger if exists casa_appliances_limit on public.casa_appliances;
create trigger casa_appliances_limit before insert on public.casa_appliances for each row execute function public.casa_limits_check();
drop trigger if exists casa_documents_limit on public.casa_documents;
create trigger casa_documents_limit before insert on public.casa_documents for each row execute function public.casa_limits_check();

-- File privati: scontrini, manuali e documenti, nella cartella dell'utente
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('casa-files', 'casa-files', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists casa_files_select on storage.objects;
create policy casa_files_select on storage.objects for select to authenticated
  using (bucket_id = 'casa-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists casa_files_insert on storage.objects;
create policy casa_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'casa-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.can_use_tool('casa') x where x.allowed)
  );
drop policy if exists casa_files_delete on storage.objects;
create policy casa_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'casa-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Cancellazione dell'account (GDPR): via case, utenze, apparecchi, documenti
-- e le loro scadenze (i file si cancellano con le altre cartelle dell'utente)
create or replace function public.casa_profile_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.casa_homes where user_id = new.id;
  return new;
end;
$$;
revoke all on function public.casa_profile_deleted_cleanup() from public, anon, authenticated;

drop trigger if exists casa_profile_deleted_cleanup on public.profiles;
create trigger casa_profile_deleted_cleanup
  after update of deleted_at on public.profiles
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.casa_profile_deleted_cleanup();

-- KU Karma: stessa funzione di prima con 'casa' aggiunto all'elenco
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
    'landing-page', 'garage', 'mandala', 'scudo-dati', 'casa'
  ) then
    return;
  end if;

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
