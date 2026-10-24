-- KUMANI TEMPUS (piano Pro): prenotazioni online per un'attività con un
-- operatore. Il titolare ha la sua pagina pubblica (kumani.io/prenota/<nome>)
-- dove i clienti, anche senza account, scelgono servizio e orario lasciando
-- nome, telefono ed email; nella sua agenda vede e gestisce le prenotazioni.
-- Niente pagamenti. Spento (Solo Staff) finché lo Staff non lo accende.
--
-- Le prenotazioni le scrive solo il server (tempus_book, con la chiave di
-- servizio): un lucchetto per attività e il controllo degli orari occupati
-- impediscono due prenotazioni sullo stesso orario anche se arrivano insieme.

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('tempus', false, true, 'pro', 'KUMANI TEMPUS – prenotazioni online: la tua pagina per prenotare, i servizi con durata e prezzo, gli orari e l''agenda')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('tempus', 'KUMANI TEMPUS', 1, 10)
on conflict (key) do nothing;

-- Pagina e impostazioni dell'attività (una per titolare)
create table if not exists public.tempus_pages (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  is_published boolean not null default false,
  title text not null default '' check (char_length(title) <= 80),
  intro text not null default '' check (char_length(intro) <= 600),
  show_prices boolean not null default true,
  timezone text not null default 'Europe/Rome' check (char_length(timezone) <= 64),
  slot_step smallint not null default 30 check (slot_step in (10, 15, 20, 30, 45, 60)),
  buffer_min smallint not null default 0 check (buffer_min between 0 and 120),
  min_notice_min integer not null default 120 check (min_notice_min between 0 and 10080),
  max_days_ahead smallint not null default 60 check (max_days_ahead between 1 and 365),
  cancel_limit_hours smallint not null default 24 check (cancel_limit_hours between 0 and 168),
  -- Orari della settimana: {"1": [["09:00","13:00"],["15:00","19:00"]], …} (0 = domenica)
  hours jsonb not null default '{}'::jsonb check (jsonb_typeof(hours) = 'object' and pg_column_size(hours) <= 4096),
  -- Lingua del titolare per le sue email (quella con cui usa TEMPUS)
  owner_locale text not null default 'it' check (owner_locale in ('it', 'fr', 'en', 'es', 'pt', 'de', 'ru')),
  suspended boolean not null default false,
  suspended_reason text check (char_length(suspended_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tempus_services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.tempus_pages(owner_id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  duration_min smallint not null check (duration_min between 5 and 600),
  price_cents integer check (price_cents between 0 and 10000000),
  active boolean not null default true,
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tempus_services_owner on public.tempus_services(owner_id, sort);

-- Giorni di chiusura (ferie, festivi)
create table if not exists public.tempus_closures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.tempus_pages(owner_id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 366)
);
create index if not exists tempus_closures_owner on public.tempus_closures(owner_id, ends_on);

create table if not exists public.tempus_bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.tempus_pages(owner_id) on delete cascade,
  service_id uuid references public.tempus_services(id) on delete set null,
  -- Copia del servizio al momento della prenotazione (resta anche se cambia)
  service_name text not null check (char_length(service_name) <= 80),
  duration_min smallint not null,
  price_cents integer,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Fine dell'impegno con la pausa dopo l'appuntamento
  blocked_until timestamptz not null,
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 80),
  customer_phone text not null default '' check (char_length(customer_phone) <= 40),
  customer_email text check (char_length(customer_email) <= 160),
  customer_note text check (char_length(customer_note) <= 500),
  owner_note text check (char_length(owner_note) <= 500),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'no_show')),
  cancelled_by text check (cancelled_by in ('customer', 'owner')),
  cancelled_at timestamptz,
  source text not null default 'online' check (source in ('online', 'manual')),
  cancel_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  locale text not null default 'it' check (locale in ('it', 'fr', 'en', 'es', 'pt', 'de', 'ru')),
  user_id uuid references auth.users(id) on delete set null,
  sender_hash text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and blocked_until >= ends_at)
);
create index if not exists tempus_bookings_owner_time on public.tempus_bookings(owner_id, starts_at);
create index if not exists tempus_bookings_reminders on public.tempus_bookings(starts_at) where status = 'confirmed' and reminder_sent_at is null and customer_email is not null;

-- Il titolare non cambia; data di creazione e sospensione restano quelle;
-- una prenotazione annullata non torna confermata (l'orario potrebbe essere
-- stato preso da un altro cliente: se ne fa una nuova)
create or replace function public.tempus_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'tempus_services' and (select count(*) from public.tempus_services where owner_id = new.owner_id) >= 60 then
      raise exception 'tempus_limit';
    end if;
    if tg_table_name = 'tempus_closures' and (select count(*) from public.tempus_closures where owner_id = new.owner_id and ends_on >= current_date) >= 100 then
      raise exception 'tempus_limit';
    end if;
    return new;
  end if;
  new.owner_id := old.owner_id;
  if tg_table_name = 'tempus_pages' then
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  if tg_table_name = 'tempus_bookings' then
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'tempus_cancelled';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists tempus_pages_guard on public.tempus_pages;
create trigger tempus_pages_guard before update on public.tempus_pages for each row execute function public.tempus_guard();
drop trigger if exists tempus_services_guard on public.tempus_services;
create trigger tempus_services_guard before insert or update on public.tempus_services for each row execute function public.tempus_guard();
drop trigger if exists tempus_closures_guard on public.tempus_closures;
create trigger tempus_closures_guard before insert or update on public.tempus_closures for each row execute function public.tempus_guard();
drop trigger if exists tempus_bookings_guard on public.tempus_bookings;
create trigger tempus_bookings_guard before update on public.tempus_bookings for each row execute function public.tempus_guard();

-- Permessi: il titolare legge e gestisce le sue righe; per scrivere serve il
-- piano. La sospensione la decide solo lo Staff (colonne fuori dal permesso
-- di modifica) e una pagina sospesa non si cancella per ricrearla.
alter table public.tempus_pages enable row level security;
alter table public.tempus_services enable row level security;
alter table public.tempus_closures enable row level security;
alter table public.tempus_bookings enable row level security;
revoke all on public.tempus_pages, public.tempus_services, public.tempus_closures, public.tempus_bookings from anon, authenticated;
grant select, insert, delete on public.tempus_pages to authenticated;
grant update (slug, is_published, title, intro, show_prices, timezone, slot_step, buffer_min, min_notice_min, max_days_ahead, cancel_limit_hours, hours, owner_locale) on public.tempus_pages to authenticated;
grant select, insert, update, delete on public.tempus_services to authenticated;
grant select, insert, update, delete on public.tempus_closures to authenticated;
grant select, delete on public.tempus_bookings to authenticated;
grant update (status, cancelled_by, cancelled_at, owner_note) on public.tempus_bookings to authenticated;

drop policy if exists tempus_pages_select on public.tempus_pages;
create policy tempus_pages_select on public.tempus_pages for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists tempus_pages_insert on public.tempus_pages;
create policy tempus_pages_insert on public.tempus_pages for insert to authenticated
  with check (owner_id = (select auth.uid()) and suspended = false and exists (select 1 from public.can_use_tool('tempus') t where t.allowed));
drop policy if exists tempus_pages_update on public.tempus_pages;
create policy tempus_pages_update on public.tempus_pages for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.can_use_tool('tempus') t where t.allowed));
drop policy if exists tempus_pages_delete on public.tempus_pages;
create policy tempus_pages_delete on public.tempus_pages for delete to authenticated using (owner_id = (select auth.uid()) and suspended = false);

drop policy if exists tempus_services_select on public.tempus_services;
create policy tempus_services_select on public.tempus_services for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists tempus_services_insert on public.tempus_services;
create policy tempus_services_insert on public.tempus_services for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.can_use_tool('tempus') t where t.allowed));
drop policy if exists tempus_services_update on public.tempus_services;
create policy tempus_services_update on public.tempus_services for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.can_use_tool('tempus') t where t.allowed));
drop policy if exists tempus_services_delete on public.tempus_services;
create policy tempus_services_delete on public.tempus_services for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists tempus_closures_select on public.tempus_closures;
create policy tempus_closures_select on public.tempus_closures for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists tempus_closures_insert on public.tempus_closures;
create policy tempus_closures_insert on public.tempus_closures for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.can_use_tool('tempus') t where t.allowed));
drop policy if exists tempus_closures_update on public.tempus_closures;
create policy tempus_closures_update on public.tempus_closures for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.can_use_tool('tempus') t where t.allowed));
drop policy if exists tempus_closures_delete on public.tempus_closures;
create policy tempus_closures_delete on public.tempus_closures for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists tempus_bookings_select on public.tempus_bookings;
create policy tempus_bookings_select on public.tempus_bookings for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists tempus_bookings_update on public.tempus_bookings;
create policy tempus_bookings_update on public.tempus_bookings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists tempus_bookings_delete on public.tempus_bookings;
create policy tempus_bookings_delete on public.tempus_bookings for delete to authenticated using (owner_id = (select auth.uid()));

-- Titolare della pagina pubblica: pubblicata, non sospesa, titolare non
-- bloccato e con TEMPUS nel piano (spento il servizio, la pagina sparisce)
create or replace function public.tempus_public_owner(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.owner_id
  from public.tempus_pages p
  where p.slug = lower(trim(p_slug))
    and p.is_published
    and not p.suspended
    and not public.is_user_blocked(p.owner_id)
    and exists (select 1 from public.tool_access(p.owner_id, 'tempus') t where t.allowed);
$$;
revoke all on function public.tempus_public_owner(text) from public, anon, authenticated;

-- Nuova prenotazione (solo dal server). Un lucchetto per attività: due
-- richieste insieme si mettono in fila e la seconda trova l'orario occupato.
-- Orari di apertura, preavviso e chiusure li controlla il server prima.
create or replace function public.tempus_book(
  p_owner uuid,
  p_service uuid,
  p_starts timestamptz,
  p_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_source text,
  p_locale text,
  p_user uuid,
  p_sender_hash text
)
returns table(booking_id uuid, cancel_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.tempus_services%rowtype;
  v_buffer smallint;
  v_ends timestamptz;
  v_blocked timestamptz;
  v_id uuid;
  v_token text;
begin
  perform pg_advisory_xact_lock(hashtextextended('tempus:' || p_owner::text, 0));
  select * into v_service from public.tempus_services where id = p_service and owner_id = p_owner;
  if not found or (not v_service.active and p_source = 'online') then
    raise exception 'tempus_service';
  end if;
  select buffer_min into v_buffer from public.tempus_pages where owner_id = p_owner;
  v_ends := p_starts + make_interval(mins => v_service.duration_min);
  v_blocked := v_ends + make_interval(mins => coalesce(v_buffer, 0));
  if exists (
    select 1 from public.tempus_bookings b
    where b.owner_id = p_owner and b.status <> 'cancelled'
      and b.starts_at < v_blocked and b.blocked_until > p_starts
  ) then
    raise exception 'tempus_taken';
  end if;
  insert into public.tempus_bookings (
    owner_id, service_id, service_name, duration_min, price_cents, starts_at, ends_at, blocked_until,
    customer_name, customer_phone, customer_email, customer_note, source, locale, user_id, sender_hash
  ) values (
    p_owner, v_service.id, v_service.name, v_service.duration_min, v_service.price_cents, p_starts, v_ends, v_blocked,
    trim(p_name), coalesce(trim(p_phone), ''), nullif(lower(trim(coalesce(p_email, ''))), ''), nullif(trim(coalesce(p_note, '')), ''),
    p_source, p_locale, p_user, p_sender_hash
  )
  returning id, tempus_bookings.cancel_token into v_id, v_token;
  return query select v_id, v_token;
end;
$$;
revoke all on function public.tempus_book(uuid, uuid, timestamptz, text, text, text, text, text, text, uuid, text) from public, anon, authenticated;

-- KU Karma del giorno anche per TEMPUS
CREATE OR REPLACE FUNCTION public.award_tool_point_for(p_user uuid, p_tool_name text)
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
  if p_user is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail', 'oxygen',
    'documento-sicuro', 'verifica-iban', 'firma-email', 'calcolatrici', 'focus',
    'landing-page', 'garage', 'mandala', 'scudo-dati', 'casa', 'nexus', 'clienti', 'hopla', 'firma-pdf', 'convivium', 'lumen', 'vox', 'captio', 'diarium', 'imago', 'forma', 'tutela', 'cronobioma', 'tempus'
  ) then
    return;
  end if;

  if not exists (select 1 from public.tool_access(p_user, p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (p_user, p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  v_ku := public.ku_points_for(p_tool_name);
  if v_rows = 0 or v_ku = 0 then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + v_ku,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
  where id = p_user
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;
