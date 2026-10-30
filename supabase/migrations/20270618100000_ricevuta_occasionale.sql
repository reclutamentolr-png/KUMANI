-- RICEVUTA PER PRESTAZIONE OCCASIONALE (KUMANI Lavoro, piano Plus): per chi
-- non ha la partita IVA e fa un lavoro occasionale (art. 2222 c.c., redditi
-- diversi art. 67 TUIR). I dati di chi rilascia la ricevuta, i clienti e le
-- ricevute numerate per anno (1/2027, 2/2027…). Spento (Solo Staff) finché lo
-- Staff non lo accende.
--
-- Regole fiscali applicate (stesse formule in src/lib/ricevutaOccasionale.ts):
-- - ritenuta d'acconto 20% solo se chi paga è sostituto d'imposta (art. 25
--   D.P.R. 600/1973), sul compenso + rimborsi, tranne le spese anticipate in
--   nome e per conto del cliente; arrotondata al centesimo (metà in su);
-- - marca da bollo da 2 € se compenso + rimborsi supera 77,47 € (D.P.R.
--   642/1972, Tariffa parte I art. 13 nota 1); se è a carico del cliente si
--   aggiunge al totale e non entra nella ritenuta;
-- - fuori campo IVA (art. 5 D.P.R. 633/1972, manca l'abitualità);
-- - oltre 5.000 € nell'anno: Gestione Separata INPS (art. 44 D.L. 269/2003),
--   solo avviso nella pagina.
-- Tutti gli importi sono centesimi interi; i vincoli qui sotto rifiutano una
-- ricevuta con i conti sbagliati.

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('ricevuta-occasionale', false, true, 'base', 'Ricevuta per prestazione occasionale – per chi non ha partita IVA: ritenuta del 20%, marca da bollo, numerazione per anno, PDF da firmare e CSV dell''anno')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('ricevuta-occasionale', 'Ricevuta per prestazione occasionale', 1, 10)
on conflict (key) do nothing;

-- Dati di chi rilascia la ricevuta (uno per persona)
create table if not exists public.occasional_receipt_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  tax_code text not null check (tax_code ~ '^[A-Z0-9]{16}$'),
  address text check (char_length(address) <= 160),
  city text check (char_length(city) <= 120),
  iban text check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  default_place text check (char_length(default_place) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Clienti riutilizzabili
create table if not exists public.occasional_receipt_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  -- Codice fiscale (16) o partita IVA (11 cifre)
  tax_id text check (tax_id ~ '^([A-Z0-9]{16}|[0-9]{11})$'),
  address text check (char_length(address) <= 160),
  city text check (char_length(city) <= 120),
  kind text not null default 'private' check (kind in ('private', 'withholding')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists occasional_receipt_clients_user on public.occasional_receipt_clients(user_id, name);

-- Ricevute: i dati di chi rilascia e del cliente sono copiati al momento
-- (il documento resta com'era anche se poi cambiano)
create table if not exists public.occasional_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year smallint not null check (year between 2000 and 2100),
  number integer not null check (number between 1 and 99999),
  issue_date date not null,
  place text check (char_length(place) <= 80),
  client_id uuid references public.occasional_receipt_clients(id) on delete set null,
  client_name text not null check (char_length(trim(client_name)) between 1 and 120),
  client_tax_id text check (client_tax_id ~ '^([A-Z0-9]{16}|[0-9]{11})$'),
  client_address text check (char_length(client_address) <= 160),
  client_city text check (char_length(client_city) <= 120),
  client_kind text not null check (client_kind in ('private', 'withholding')),
  issuer_name text not null check (char_length(trim(issuer_name)) between 1 and 120),
  issuer_tax_code text not null check (issuer_tax_code ~ '^[A-Z0-9]{16}$'),
  issuer_address text check (char_length(issuer_address) <= 160),
  issuer_city text check (char_length(issuer_city) <= 120),
  issuer_iban text check (issuer_iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  description text not null check (char_length(trim(description)) between 1 and 2000),
  period_from date,
  period_to date,
  gross_cents integer not null check (gross_cents between 1 and 50000000),
  expenses_cents integer not null default 0 check (expenses_cents between 0 and 50000000),
  expenses_on_behalf boolean not null default false,
  withholding boolean not null,
  withholding_cents integer not null check (withholding_cents >= 0),
  stamp_required boolean not null,
  stamp_charge text not null default 'client' check (stamp_charge in ('client', 'issuer')),
  stamp_cents integer not null check (stamp_cents in (0, 200)),
  stamp_id text check (stamp_id ~ '^[0-9]{1,20}$'),
  total_cents integer not null,
  net_cents integer not null,
  paid_on date,
  cancelled_at timestamptz,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, number),
  check (period_to is null or period_from is null or period_to >= period_from),
  -- Il ritenuto: il cliente deve essere sostituto d'imposta, e viceversa
  check (withholding = (client_kind = 'withholding')),
  -- Conti della ricevuta (bigint: niente traboccamenti)
  check (withholding_cents = case when withholding
    then ((gross_cents::bigint + case when expenses_on_behalf then 0 else expenses_cents end) * 20 + 50) / 100
    else 0 end),
  check (stamp_required = (gross_cents::bigint + expenses_cents > 7747)),
  check (stamp_cents = case when stamp_required and stamp_charge = 'client' then 200 else 0 end),
  check (total_cents = gross_cents + expenses_cents + stamp_cents),
  check (net_cents = total_cents - withholding_cents)
);
create index if not exists occasional_receipts_user_year on public.occasional_receipts(user_id, year, number desc);
create index if not exists occasional_receipts_client on public.occasional_receipts(client_id) where client_id is not null;

-- Numero progressivo per anno assegnato dal database: un lucchetto per
-- persona e anno fa aspettare il secondo salvataggio (due dispositivi insieme)
-- e il vincolo unique è la seconda sicurezza. Il numero inviato dal browser
-- non conta. Dopo: numero, anno e proprietario non cambiano, e la data resta
-- nello stesso anno (altrimenti il numero non sarebbe più quello giusto).
create or replace function public.occasional_receipts_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.year := extract(year from new.issue_date)::smallint;
    perform pg_advisory_xact_lock(hashtextextended('occasional_receipts:' || new.user_id::text || ':' || new.year::text, 0));
    if (select count(*) from public.occasional_receipts where user_id = new.user_id and year = new.year) >= 5000 then
      raise exception 'ro_limit';
    end if;
    select coalesce(max(number), 0) + 1 into new.number
      from public.occasional_receipts
      where user_id = new.user_id and year = new.year;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  new.user_id := old.user_id;
  new.year := old.year;
  new.number := old.number;
  new.created_at := old.created_at;
  new.updated_at := now();
  if extract(year from new.issue_date)::smallint <> old.year then
    raise exception 'ro_year_change';
  end if;
  return new;
end;
$$;
drop trigger if exists occasional_receipts_number on public.occasional_receipts;
create trigger occasional_receipts_number before insert or update on public.occasional_receipts
  for each row execute function public.occasional_receipts_number();

-- Clienti: al massimo 1000 per persona; il proprietario non cambia
create or replace function public.occasional_receipt_clients_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.occasional_receipt_clients where user_id = new.user_id) >= 1000 then
      raise exception 'ro_limit';
    end if;
    return new;
  end if;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists occasional_receipt_clients_guard on public.occasional_receipt_clients;
create trigger occasional_receipt_clients_guard before insert or update on public.occasional_receipt_clients
  for each row execute function public.occasional_receipt_clients_guard();

-- Si può eliminare solo l'ultima ricevuta dell'anno (così la numerazione
-- resta senza buchi); le altre si annullano e restano nell'elenco.
create or replace function public.occasional_receipt_is_last(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.occasional_receipts r
    join public.occasional_receipts o on o.user_id = r.user_id and o.year = r.year and o.number > r.number
    where r.id = p_id and r.user_id = (select auth.uid())
  );
$$;
revoke all on function public.occasional_receipt_is_last(uuid) from public, anon;
grant execute on function public.occasional_receipt_is_last(uuid) to authenticated;

-- Permessi: ognuno vede e gestisce solo le sue righe; per scrivere serve il piano
alter table public.occasional_receipt_profiles enable row level security;
alter table public.occasional_receipt_clients enable row level security;
alter table public.occasional_receipts enable row level security;

drop policy if exists occasional_receipt_profiles_select on public.occasional_receipt_profiles;
create policy occasional_receipt_profiles_select on public.occasional_receipt_profiles for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists occasional_receipt_profiles_insert on public.occasional_receipt_profiles;
create policy occasional_receipt_profiles_insert on public.occasional_receipt_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists occasional_receipt_profiles_update on public.occasional_receipt_profiles;
create policy occasional_receipt_profiles_update on public.occasional_receipt_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists occasional_receipt_profiles_delete on public.occasional_receipt_profiles;
create policy occasional_receipt_profiles_delete on public.occasional_receipt_profiles for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists occasional_receipt_profiles_plan_insert on public.occasional_receipt_profiles;
create policy occasional_receipt_profiles_plan_insert on public.occasional_receipt_profiles as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('ricevuta-occasionale') t where t.allowed));
drop policy if exists occasional_receipt_profiles_plan_update on public.occasional_receipt_profiles;
create policy occasional_receipt_profiles_plan_update on public.occasional_receipt_profiles as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('ricevuta-occasionale') t where t.allowed));

drop policy if exists occasional_receipt_clients_select on public.occasional_receipt_clients;
create policy occasional_receipt_clients_select on public.occasional_receipt_clients for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists occasional_receipt_clients_insert on public.occasional_receipt_clients;
create policy occasional_receipt_clients_insert on public.occasional_receipt_clients for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists occasional_receipt_clients_update on public.occasional_receipt_clients;
create policy occasional_receipt_clients_update on public.occasional_receipt_clients for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists occasional_receipt_clients_delete on public.occasional_receipt_clients;
create policy occasional_receipt_clients_delete on public.occasional_receipt_clients for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists occasional_receipt_clients_plan_insert on public.occasional_receipt_clients;
create policy occasional_receipt_clients_plan_insert on public.occasional_receipt_clients as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('ricevuta-occasionale') t where t.allowed));
drop policy if exists occasional_receipt_clients_plan_update on public.occasional_receipt_clients;
create policy occasional_receipt_clients_plan_update on public.occasional_receipt_clients as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('ricevuta-occasionale') t where t.allowed));

drop policy if exists occasional_receipts_select on public.occasional_receipts;
create policy occasional_receipts_select on public.occasional_receipts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists occasional_receipts_insert on public.occasional_receipts;
create policy occasional_receipts_insert on public.occasional_receipts for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists occasional_receipts_update on public.occasional_receipts;
create policy occasional_receipts_update on public.occasional_receipts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists occasional_receipts_delete on public.occasional_receipts;
create policy occasional_receipts_delete on public.occasional_receipts for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists occasional_receipts_delete_last on public.occasional_receipts;
create policy occasional_receipts_delete_last on public.occasional_receipts as restrictive for delete to authenticated
  using (public.occasional_receipt_is_last(id));
drop policy if exists occasional_receipts_plan_insert on public.occasional_receipts;
create policy occasional_receipts_plan_insert on public.occasional_receipts as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('ricevuta-occasionale') t where t.allowed));
drop policy if exists occasional_receipts_plan_update on public.occasional_receipts;
create policy occasional_receipts_plan_update on public.occasional_receipts as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('ricevuta-occasionale') t where t.allowed));
