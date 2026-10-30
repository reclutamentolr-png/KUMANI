-- KUMANI Sorpresa: «Regalo con consegna». Chi crea la sorpresa scrive chi
-- consegna il regalo (es. la massaggiatrice: nome, attività, telefono, email,
-- dove si ritira) e conferma di averlo già pagato o concordato con lei.
-- Chi riceve vede un buono con codice unico (KMN-XXXX-XXX) e QR e con un
-- tocco chiede di ritirarlo; chi consegna riceve un'email con il link
-- segreto «Gestisci il regalo» (senza account), fissa l'appuntamento e segna
-- il regalo come consegnato (stato definitivo). Chi ha regalato segue i passi.
--
-- - surprise_deliveries: una riga per sorpresa (dati di chi consegna, codice,
--   stato e date). Chi crea la sorpresa scrive solo i dati di chi consegna;
--   codice, stato, date e link li decide solo il server (chiave di servizio).
-- - surprise_delivery_requests: le richieste di chi riceve (quando, come
--   ricontattarlo, messaggio). Solo il server le scrive e le legge.
-- Il link segreto non è salvato: nel database c'è solo la sua impronta
-- (sha256), il link si ricava sul server con una chiave che il database non ha.

create table if not exists public.surprise_deliveries (
  gift_id uuid primary key references public.surprise_gifts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null check (char_length(btrim(provider_name)) between 1 and 80),
  provider_business text not null default '' check (char_length(provider_business) <= 80),
  provider_phone text check (provider_phone is null or provider_phone ~ '^\+[0-9]{6,15}$'),
  provider_email text not null check (char_length(provider_email) <= 254 and provider_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  pickup_info text not null default '' check (char_length(pickup_info) <= 500),
  -- «Ho già pagato o concordato il regalo con questa persona»
  agreed_at timestamptz not null default now(),
  code text not null unique check (code ~ '^KMN-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'requested', 'booked', 'delivered')),
  requested_at timestamptz,
  booked_at timestamptz,
  delivered_at timestamptz,
  booking_text text not null default '' check (char_length(booking_text) <= 200),
  booking_at timestamptz,
  -- Serve al server per ricavare il link segreto (con la sua chiave)
  manage_nonce uuid not null default gen_random_uuid(),
  manage_token_hash text unique check (manage_token_hash is null or manage_token_hash ~ '^[0-9a-f]{64}$'),
  link_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'delivered' or delivered_at is not null)
);
create index if not exists surprise_deliveries_user_idx on public.surprise_deliveries (user_id);

create table if not exists public.surprise_delivery_requests (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.surprise_deliveries(gift_id) on delete cascade,
  when_text text not null default '' check (char_length(when_text) <= 120),
  contact text not null check (char_length(btrim(contact)) between 3 and 120),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists surprise_delivery_requests_gift_idx on public.surprise_delivery_requests (gift_id, created_at desc);

-- Codice del buono: KMN- + 4 + 3 caratteri senza quelli che si confondono
-- (niente 0, O, 1, I, L), da byte casuali veri; si riprova se esiste già
create or replace function public.surprise_delivery_new_code()
returns text
language plpgsql
volatile
-- security definer: il controllo dei doppioni vede anche i codici degli altri
security definer
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea;
  candidate text;
  i int;
begin
  loop
    bytes := extensions.gen_random_bytes(7);
    candidate := 'KMN-';
    for i in 0..6 loop
      if i = 4 then
        candidate := candidate || '-';
      end if;
      candidate := candidate || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.surprise_deliveries where code = candidate);
  end loop;
  return candidate;
end;
$$;
-- (la chiama la regola qui sotto anche per chi crea la sorpresa: un codice
-- casuale in sé non rivela nulla)
revoke all on function public.surprise_delivery_new_code() from public, anon;
grant execute on function public.surprise_delivery_new_code() to authenticated, service_role;

alter table public.surprise_deliveries enable row level security;
alter table public.surprise_delivery_requests enable row level security;

-- Chi crea la sorpresa vede e scrive i dati di chi consegna delle sue sorprese
drop policy if exists surprise_deliveries_own on public.surprise_deliveries;
create policy surprise_deliveries_own on public.surprise_deliveries for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.surprise_gifts g where g.id = gift_id and g.user_id = (select auth.uid())));
grant select, insert, update, delete on public.surprise_deliveries to authenticated;
revoke truncate, references, trigger on public.surprise_deliveries from authenticated;
revoke all on public.surprise_deliveries from anon;
-- Richieste: nessuna regola, solo il server (chiave di servizio)
revoke all on public.surprise_delivery_requests from anon, authenticated;

-- Codice, stato, date e link: solo il server. Dopo la prima richiesta i dati
-- di chi consegna non cambiano più (la persona ha già ricevuto l'email) e la
-- riga non si cancella.
create or replace function public.surprise_deliveries_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  rank_old int;
  rank_new int;
begin
  -- Consegnato è definitivo per tutti, anche per il server; lo stato va solo avanti
  if tg_op = 'UPDATE' then
    if old.status = 'delivered' and (
      new.status, new.delivered_at, new.booking_text, new.booking_at, new.requested_at, new.booked_at,
      new.provider_name, new.provider_business, new.provider_phone, new.provider_email, new.pickup_info, new.code
    ) is distinct from (
      old.status, old.delivered_at, old.booking_text, old.booking_at, old.requested_at, old.booked_at,
      old.provider_name, old.provider_business, old.provider_phone, old.provider_email, old.pickup_info, old.code
    ) then
      raise exception 'surprise_delivery_final' using errcode = 'P0001';
    end if;
    rank_old := array_position(array['pending', 'requested', 'booked', 'delivered'], old.status);
    rank_new := array_position(array['pending', 'requested', 'booked', 'delivered'], new.status);
    if rank_new < rank_old then
      raise exception 'surprise_delivery_backwards' using errcode = 'P0001';
    end if;
  end if;

  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    if tg_op = 'INSERT' and (new.code is null or new.code = '') then
      new.code := public.surprise_delivery_new_code();
    end if;
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.code := public.surprise_delivery_new_code();
    new.status := 'pending';
    new.requested_at := null;
    new.booked_at := null;
    new.delivered_at := null;
    new.booking_text := '';
    new.booking_at := null;
    new.manage_nonce := gen_random_uuid();
    new.manage_token_hash := null;
    new.link_sent_at := null;
    new.agreed_at := now();
    new.created_at := now();
  else
    if old.status <> 'pending' and (new.provider_name, new.provider_business, new.provider_phone, new.provider_email, new.pickup_info)
        is distinct from (old.provider_name, old.provider_business, old.provider_phone, old.provider_email, old.pickup_info) then
      raise exception 'surprise_delivery_locked' using errcode = 'P0001';
    end if;
    new.gift_id := old.gift_id;
    new.user_id := old.user_id;
    new.code := old.code;
    new.status := old.status;
    new.requested_at := old.requested_at;
    new.booked_at := old.booked_at;
    new.delivered_at := old.delivered_at;
    new.booking_text := old.booking_text;
    new.booking_at := old.booking_at;
    new.created_at := old.created_at;
    -- Altra email di chi consegna: il link segreto già mandato smette di valere
    -- (se ne ricava uno nuovo, che arriva solo alla nuova email)
    if new.provider_email is distinct from old.provider_email then
      new.manage_nonce := gen_random_uuid();
      new.manage_token_hash := null;
      new.link_sent_at := null;
    else
      new.manage_nonce := old.manage_nonce;
      new.manage_token_hash := old.manage_token_hash;
      new.link_sent_at := old.link_sent_at;
    end if;
    -- Cambiando la persona si conferma di nuovo l'accordo
    if (new.provider_name, new.provider_email) is distinct from (old.provider_name, old.provider_email) then
      new.agreed_at := now();
    else
      new.agreed_at := old.agreed_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists surprise_deliveries_guard on public.surprise_deliveries;
create trigger surprise_deliveries_guard before insert or update on public.surprise_deliveries
  for each row execute function public.surprise_deliveries_guard();

create or replace function public.surprise_deliveries_delete_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- La cancellazione della sorpresa (solo bozze) porta via anche questa riga
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return old;
  end if;
  if old.status <> 'pending' and exists (select 1 from public.surprise_gifts g where g.id = old.gift_id) then
    raise exception 'surprise_delivery_locked' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
drop trigger if exists surprise_deliveries_delete_guard on public.surprise_deliveries;
create trigger surprise_deliveries_delete_guard before delete on public.surprise_deliveries
  for each row execute function public.surprise_deliveries_delete_guard();

-- Freno contro gli abusi: al massimo 3 richieste in 24 ore e 10 in tutto per regalo
create or replace function public.surprise_delivery_requests_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('surprise_delivery_requests:' || new.gift_id::text));
  if (select count(*) from public.surprise_delivery_requests where gift_id = new.gift_id and created_at > now() - interval '24 hours') >= 3
     or (select count(*) from public.surprise_delivery_requests where gift_id = new.gift_id) >= 10 then
    raise exception 'surprise_delivery_request_limit' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.surprise_deliveries d where d.gift_id = new.gift_id and d.status = 'delivered') then
    raise exception 'surprise_delivery_final' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists surprise_delivery_requests_limit on public.surprise_delivery_requests;
create trigger surprise_delivery_requests_limit before insert on public.surprise_delivery_requests
  for each row execute function public.surprise_delivery_requests_limit();

-- ─── Sei aperture nuove del regalo ───
-- candeline da spegnere, palloncino da scoppiare, biscotto della fortuna,
-- sipario, foto che si sviluppa e cassaforte con il codice. Per la
-- cassaforte chi crea sceglie un codice di 4 cifre e un indizio: il codice
-- lo controlla il server (la pagina pubblica non lo manda mai al browser).
alter table public.surprise_gifts drop constraint if exists surprise_gifts_reveal_check;
alter table public.surprise_gifts add constraint surprise_gifts_reveal_check
  check (reveal_style in ('box', 'envelope', 'scratch', 'candles', 'balloon', 'cookie', 'curtain', 'polaroid', 'safe'));
alter table public.surprise_gifts
  add column if not exists safe_code text check (safe_code is null or safe_code ~ '^[0-9]{4}$'),
  add column if not exists safe_hint text not null default '' check (char_length(safe_hint) <= 120);
