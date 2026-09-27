-- KUMANI Events — Fase 1: eventi della community con approvazione, calendario
-- pubblico, iscrizione gratuita, pass QR nominativo e check-in.
-- Organizza solo un Kumano Verificato (stessa verifica di Kordata) con il
-- piano dello strumento 'events' (Base di default). Il prezzo dichiarato si
-- paga all'organizzatore sul posto: KUMANI non incassa, ma a evento concluso
-- calcola la sua commissione (percentuale in Admin), che l'organizzatore paga
-- con carta; finché non la paga non pubblica nuovi eventi.

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 10 and 3000),
  type text not null check (type in ('meetup', 'workshop', 'wellness', 'business', 'food', 'sport', 'travel', 'online', 'social')),
  mode text not null default 'in_person' check (mode in ('in_person', 'online', 'hybrid')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Europe/Rome' check (char_length(timezone) <= 60),
  venue_name text check (char_length(venue_name) <= 120),
  address text check (char_length(address) <= 200),
  city text check (char_length(city) <= 80),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  map_link text check (map_link is null or map_link ~* '^https?://'),
  online_link text check (online_link is null or online_link ~* '^https?://'),
  languages text[] not null default '{it}',
  capacity int not null check (capacity between 1 and 500),
  price numeric(10, 2) not null default 0 check (price >= 0 and price <= 10000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  is_18plus boolean not null default false,
  kids_friendly boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'cancelled', 'banned')),
  review_note text,
  fee_percent numeric(5, 2) not null default 0,
  rules_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (mode = 'in_person' or online_link is not null),
  check (mode = 'online' or city is not null)
);
create index if not exists idx_events_status on public.events(status, starts_at);
create index if not exists idx_events_geo on public.events(country_code, city, starts_at);
create index if not exists idx_events_organizer on public.events(organizer_id);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'cancelled', 'checked_in', 'no_show')),
  pass_token text not null unique,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists idx_participants_event on public.event_participants(event_id);
create index if not exists idx_participants_user on public.event_participants(user_id);

create table if not exists public.event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reporter uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

-- Commissione KUMANI di un evento concluso (prezzo dichiarato × iscritti × %)
create table if not exists public.event_fees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  participants int not null,
  price numeric(10, 2) not null,
  percent numeric(5, 2) not null,
  amount numeric(10, 2) not null,
  status text not null default 'due' check (status in ('due', 'paid', 'waived')),
  stripe_session_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_event_fees_organizer on public.event_fees(organizer_id, status);

alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_reports enable row level security;
alter table public.event_fees enable row level security;

-- Letture dirette (agenda, wallet): eventi pubblicati o miei; le mie
-- iscrizioni; le mie commissioni. Tutte le scritture passano dalle funzioni.
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (status = 'published' or organizer_id = (select auth.uid()));
drop policy if exists event_participants_select on public.event_participants;
create policy event_participants_select on public.event_participants for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists event_fees_select on public.event_fees;
create policy event_fees_select on public.event_fees for select to authenticated
  using (organizer_id = (select auth.uid()));
grant select on public.events, public.event_participants, public.event_fees to authenticated;

insert into public.marketplace_settings (tool_name, is_enabled, required_plan)
values ('events', true, 'base')
on conflict (tool_name) do nothing;

insert into public.system_settings (key, value)
values ('events_fee_percent', '"5"')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Aiutanti
-- ---------------------------------------------------------------------------
create or replace function public.event_end(p_event public.events)
returns timestamptz
language sql
immutable
as $$
  select coalesce(p_event.ends_at, p_event.starts_at + interval '3 hours');
$$;

create or replace function public.event_people(p_event uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.event_participants
  where event_id = p_event and status in ('registered', 'checked_in', 'no_show');
$$;

-- Eventi già approvati dello stesso organizzatore: dal terzo in poi si
-- pubblica senza approvazione e con più posti.
create or replace function public.event_organizer_trusted(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*) from public.events where organizer_id = p_uid and status = 'published') >= 2;
$$;

-- Calcola le commissioni degli eventi conclusi (una volta sola per evento).
create or replace function public.events_settle_fees(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_fees (event_id, organizer_id, participants, price, percent, amount)
  select e.id, e.organizer_id, public.event_people(e.id), e.price, e.fee_percent,
         round(e.price * public.event_people(e.id) * e.fee_percent / 100, 2)
  from public.events e
  where e.organizer_id = p_uid
    and e.status = 'published'
    and public.event_end(e) < now()
    and e.price > 0 and e.fee_percent > 0
    and public.event_people(e.id) > 0
    and not exists (select 1 from public.event_fees f where f.event_id = e.id)
  on conflict (event_id) do nothing;
end;
$$;

create or replace function public.event_organizer_status(p_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.events_settle_fees(p_uid);
  return public.convivio_leader_checks(p_uid) || jsonb_build_object(
    'verified', public.convivio_is_verified(p_uid),
    'plan', exists (select 1 from public.tool_access(p_uid, 'events') t where t.allowed),
    'trusted', public.event_organizer_trusted(p_uid),
    'fees_due', coalesce((select sum(amount) from public.event_fees where organizer_id = p_uid and status = 'due'), 0),
    'fee_percent', coalesce(nullif(public.setting_text('events_fee_percent'), '')::numeric, 5)
  );
end;
$$;

create or replace function public.event_my_organizer_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.event_organizer_status(auth.uid());
$$;

-- Vista pubblica di un evento (senza indirizzo esatto né link online).
create or replace function public.event_card(p_event public.events)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_event.id,
    'title', p_event.title,
    'description', p_event.description,
    'type', p_event.type,
    'mode', p_event.mode,
    'starts_at', p_event.starts_at,
    'ends_at', p_event.ends_at,
    'timezone', p_event.timezone,
    'venue_name', p_event.venue_name,
    'city', p_event.city,
    'country_code', p_event.country_code,
    'languages', to_jsonb(p_event.languages),
    'capacity', p_event.capacity,
    'people', public.event_people(p_event.id),
    'price', p_event.price,
    'currency', p_event.currency,
    'is_18plus', p_event.is_18plus,
    'kids_friendly', p_event.kids_friendly,
    'status', p_event.status,
    'ended', public.event_end(p_event) < now(),
    'organizer_name', (select coalesce(nullif(trim(first_name), ''), '—') from public.profiles where id = p_event.organizer_id),
    'organizer_referral', (select referral_code from public.profiles where id = p_event.organizer_id),
    'organizer_trusted', public.event_organizer_trusted(p_event.organizer_id)
  );
$$;
revoke all on function public.event_card(public.events) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Calendario e dettaglio (anche per chi non è iscritto)
-- ---------------------------------------------------------------------------
create or replace function public.event_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.event_card(e) order by e.starts_at), '[]'::jsonb)
  from (
    select * from public.events
    where status = 'published' and coalesce(ends_at, starts_at + interval '3 hours') > now()
    order by starts_at
    limit 300
  ) e;
$$;

create or replace function public.event_detail(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_me public.event_participants%rowtype;
  v_is_organizer boolean;
  v_registered boolean;
begin
  select * into v_event from public.events where id = p_event;
  if not found then
    return null;
  end if;
  v_is_organizer := v_uid is not null and v_event.organizer_id = v_uid;
  select * into v_me from public.event_participants where event_id = p_event and user_id = v_uid;
  v_registered := found and v_me.status in ('registered', 'checked_in', 'no_show');
  -- Non pubblicati: solo l'organizzatore (e chi era iscritto, per sapere che è annullato)
  if v_event.status <> 'published' and not v_is_organizer and not (found and v_event.status = 'cancelled') then
    return null;
  end if;
  return public.event_card(v_event) || jsonb_build_object(
    'is_organizer', v_is_organizer,
    'review_note', case when v_is_organizer then v_event.review_note end,
    -- Indirizzo esatto e link online solo a iscritti e organizzatore
    'address', case when v_registered or v_is_organizer then v_event.address end,
    'map_link', case when v_registered or v_is_organizer then v_event.map_link end,
    'online_link', case when v_registered or v_is_organizer then v_event.online_link end,
    'my_status', case when v_me.id is not null then v_me.status end,
    'my_pass', case when v_registered then v_me.pass_token end,
    'fee_percent', case when v_is_organizer then v_event.fee_percent end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizzatore
-- ---------------------------------------------------------------------------
create or replace function public.event_validate(p jsonb)
returns text
language plpgsql
stable
as $$
declare
  v_mode text := coalesce(p ->> 'mode', 'in_person');
begin
  if char_length(trim(coalesce(p ->> 'title', ''))) < 3 or char_length(trim(coalesce(p ->> 'description', ''))) < 10 then
    return 'invalid';
  end if;
  if (p ->> 'starts_at') is null or (p ->> 'starts_at')::timestamptz < now() + interval '1 hour' then
    return 'starts_soon';
  end if;
  if (p ->> 'ends_at') is not null and (p ->> 'ends_at')::timestamptz <= (p ->> 'starts_at')::timestamptz then
    return 'dates';
  end if;
  if v_mode in ('online', 'hybrid') and coalesce(p ->> 'online_link', '') !~* '^https?://' then
    return 'online_link';
  end if;
  if v_mode in ('in_person', 'hybrid') and char_length(trim(coalesce(p ->> 'city', ''))) < 2 then
    return 'city';
  end if;
  return null;
end;
$$;

create or replace function public.event_save(p_event uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status jsonb;
  v_problem text;
  v_trusted boolean;
  v_max int;
  v_capacity int;
  v_langs text[];
  v_id uuid;
  v_existing public.events%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  v_status := public.event_organizer_status(v_uid);
  if not (v_status ->> 'verified')::boolean then
    return jsonb_build_object('error', 'not_verified');
  end if;
  if not (v_status ->> 'plan')::boolean then
    return jsonb_build_object('error', 'plan_required');
  end if;
  if coalesce((p ->> 'rules_accepted')::boolean, false) is not true then
    return jsonb_build_object('error', 'rules');
  end if;
  v_problem := public.event_validate(p);
  if v_problem is not null then
    return jsonb_build_object('error', v_problem);
  end if;

  v_trusted := (v_status ->> 'trusted')::boolean;
  v_max := case when v_trusted then 100 else 20 end;
  v_capacity := coalesce((p ->> 'capacity')::int, 0);
  if v_capacity < 1 or v_capacity > v_max then
    return jsonb_build_object('error', 'capacity', 'max', v_max);
  end if;
  select coalesce(array_agg(distinct l), '{}') into v_langs
  from jsonb_array_elements_text(case when jsonb_typeof(p -> 'languages') = 'array' then p -> 'languages' else '[]'::jsonb end) l
  where l in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru');
  if cardinality(v_langs) = 0 then
    return jsonb_build_object('error', 'languages');
  end if;

  if p_event is null then
    -- Commissioni arretrate: si blocca da 0,50 € (minimo pagabile con carta)
    if (v_status ->> 'fees_due')::numeric >= 0.5 then
      return jsonb_build_object('error', 'fees_due');
    end if;
    if (select count(*) from public.events where organizer_id = v_uid and status in ('pending', 'published') and coalesce(ends_at, starts_at + interval '3 hours') > now()) >= 10 then
      return jsonb_build_object('error', 'too_many');
    end if;
    insert into public.events (
      organizer_id, title, description, type, mode, starts_at, ends_at, timezone, venue_name, address, city, country_code,
      map_link, online_link, languages, capacity, price, is_18plus, kids_friendly, status, fee_percent
    ) values (
      v_uid, left(trim(p ->> 'title'), 100), left(trim(p ->> 'description'), 3000), p ->> 'type', coalesce(p ->> 'mode', 'in_person'),
      (p ->> 'starts_at')::timestamptz, nullif(p ->> 'ends_at', '')::timestamptz, coalesce(nullif(p ->> 'timezone', ''), 'Europe/Rome'),
      nullif(left(trim(coalesce(p ->> 'venue_name', '')), 120), ''), nullif(left(trim(coalesce(p ->> 'address', '')), 200), ''),
      nullif(left(trim(coalesce(p ->> 'city', '')), 80), ''), nullif(upper(p ->> 'country_code'), ''),
      nullif(p ->> 'map_link', ''), nullif(p ->> 'online_link', ''), v_langs, v_capacity,
      greatest(coalesce((p ->> 'price')::numeric, 0), 0), coalesce((p ->> 'is_18plus')::boolean, false), coalesce((p ->> 'kids_friendly')::boolean, false),
      case when v_trusted then 'published' else 'pending' end,
      (v_status ->> 'fee_percent')::numeric
    ) returning id into v_id;
    return jsonb_build_object('id', v_id, 'status', case when v_trusted then 'published' else 'pending' end);
  end if;

  select * into v_existing from public.events where id = p_event and organizer_id = v_uid for update;
  if not found or v_existing.status in ('banned', 'cancelled') then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if public.event_end(v_existing) < now() then
    return jsonb_build_object('error', 'ended');
  end if;
  if v_capacity < public.event_people(p_event) then
    return jsonb_build_object('error', 'capacity_below_people');
  end if;
  update public.events set
    title = left(trim(p ->> 'title'), 100),
    description = left(trim(p ->> 'description'), 3000),
    type = p ->> 'type',
    mode = coalesce(p ->> 'mode', 'in_person'),
    starts_at = (p ->> 'starts_at')::timestamptz,
    ends_at = nullif(p ->> 'ends_at', '')::timestamptz,
    timezone = coalesce(nullif(p ->> 'timezone', ''), 'Europe/Rome'),
    venue_name = nullif(left(trim(coalesce(p ->> 'venue_name', '')), 120), ''),
    address = nullif(left(trim(coalesce(p ->> 'address', '')), 200), ''),
    city = nullif(left(trim(coalesce(p ->> 'city', '')), 80), ''),
    country_code = nullif(upper(p ->> 'country_code'), ''),
    map_link = nullif(p ->> 'map_link', ''),
    online_link = nullif(p ->> 'online_link', ''),
    languages = v_langs,
    capacity = v_capacity,
    -- Il prezzo non si cambia dopo le prime iscrizioni
    price = case when public.event_people(p_event) > 0 then v_existing.price else greatest(coalesce((p ->> 'price')::numeric, 0), 0) end,
    is_18plus = coalesce((p ->> 'is_18plus')::boolean, false),
    kids_friendly = coalesce((p ->> 'kids_friendly')::boolean, false),
    -- Chi non è ancora fidato: ogni modifica torna in approvazione
    status = case when v_trusted then v_existing.status when v_existing.status = 'rejected' then 'pending' else 'pending' end,
    review_note = null,
    rules_accepted_at = now(),
    updated_at = now()
  where id = p_event;
  return jsonb_build_object('id', p_event, 'status', case when v_trusted then v_existing.status else 'pending' end);
end;
$$;

create or replace function public.event_cancel(p_event uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events set status = 'cancelled', updated_at = now()
  where id = p_event and organizer_id = auth.uid() and status in ('pending', 'published')
    and coalesce(ends_at, starts_at + interval '3 hours') > now();
  return case when found then 'ok' else 'not_allowed' end;
end;
$$;

-- I miei eventi da organizzatore, con iscritti e commissione.
create or replace function public.event_my_organized()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform public.events_settle_fees(v_uid);
  return coalesce((
    select jsonb_agg(public.event_card(e) || jsonb_build_object(
      'review_note', e.review_note,
      'checked_in', (select count(*) from public.event_participants p where p.event_id = e.id and p.status = 'checked_in'),
      'fee', (select jsonb_build_object('id', f.id, 'amount', f.amount, 'status', f.status, 'participants', f.participants, 'percent', f.percent)
              from public.event_fees f where f.event_id = e.id)
    ) order by (public.event_end(e) < now()), e.starts_at)
    from public.events e where e.organizer_id = v_uid
  ), '[]'::jsonb);
end;
$$;

-- Iscritti (solo organizzatore): nome e stato, per il check-in.
create or replace function public.event_attendees(p_event uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ep.id,
    'name', trim(coalesce(pr.first_name, '') || ' ' || left(coalesce(pr.last_name, ''), 1) || case when coalesce(pr.last_name, '') <> '' then '.' else '' end),
    'status', ep.status,
    'checked_in_at', ep.checked_in_at,
    'code', right(ep.pass_token, 6)
  ) order by pr.first_name), '[]'::jsonb)
  from public.event_participants ep
  join public.profiles pr on pr.id = ep.user_id
  join public.events e on e.id = ep.event_id
  where ep.event_id = p_event and e.organizer_id = auth.uid() and ep.status <> 'cancelled';
$$;

-- Check-in: l'organizzatore inquadra il pass (o scrive il codice). Si accetta
-- il token intero o le sue ultime 6 cifre.
create or replace function public.event_checkin(p_event uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '^.*/', ''));
  v_part public.event_participants%rowtype;
  v_name text;
begin
  select * into v_event from public.events where id = p_event and organizer_id = auth.uid();
  if not found then
    return jsonb_build_object('result', 'not_allowed');
  end if;
  if now() < v_event.starts_at - interval '1 day' or now() > public.event_end(v_event) + interval '1 day' then
    return jsonb_build_object('result', 'not_today');
  end if;
  select * into v_part from public.event_participants
  where event_id = p_event and (pass_token = v_code or (char_length(v_code) = 6 and right(pass_token, 6) = v_code))
  limit 1;
  if not found or v_part.status = 'cancelled' then
    return jsonb_build_object('result', 'invalid');
  end if;
  select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_name from public.profiles where id = v_part.user_id;
  if v_part.status = 'checked_in' then
    return jsonb_build_object('result', 'already', 'name', v_name, 'at', v_part.checked_in_at);
  end if;
  update public.event_participants set status = 'checked_in', checked_in_at = now() where id = v_part.id;
  return jsonb_build_object('result', 'ok', 'name', v_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Partecipanti
-- ---------------------------------------------------------------------------
create or replace function public.event_register(p_event uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_profile public.profiles%rowtype;
  v_existing public.event_participants%rowtype;
  v_token text;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_logged');
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if coalesce(v_profile.is_blocked, false) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  select * into v_event from public.events where id = p_event for update;
  if not found or v_event.status <> 'published' then
    return jsonb_build_object('error', 'not_available');
  end if;
  if v_event.starts_at < now() then
    return jsonb_build_object('error', 'started');
  end if;
  if v_event.organizer_id = v_uid then
    return jsonb_build_object('error', 'organizer');
  end if;
  if v_event.is_18plus and (v_profile.date_of_birth is null or v_profile.date_of_birth = date '2000-01-01'
     or v_profile.date_of_birth > (current_date - interval '18 years')) then
    return jsonb_build_object('error', 'age');
  end if;
  select * into v_existing from public.event_participants where event_id = p_event and user_id = v_uid;
  if v_existing.id is not null and v_existing.status <> 'cancelled' then
    return jsonb_build_object('pass', v_existing.pass_token);
  end if;
  if public.event_people(p_event) >= v_event.capacity then
    return jsonb_build_object('error', 'full');
  end if;
  loop
    v_token := upper(substring(md5(gen_random_uuid()::text) from 1 for 12));
    exit when not exists (select 1 from public.event_participants where pass_token = v_token);
  end loop;
  if v_existing.id is not null then
    update public.event_participants set status = 'registered', pass_token = v_token, checked_in_at = null, created_at = now()
    where id = v_existing.id;
  else
    insert into public.event_participants (event_id, user_id, pass_token) values (p_event, v_uid, v_token)
    on conflict (event_id, user_id) do update set status = 'registered', pass_token = excluded.pass_token, checked_in_at = null;
  end if;
  return jsonb_build_object('pass', v_token);
end;
$$;

create or replace function public.event_unregister(p_event uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_participants ep set status = 'cancelled'
  from public.events e
  where ep.event_id = p_event and ep.user_id = auth.uid() and ep.status = 'registered'
    and e.id = ep.event_id and e.starts_at > now();
  return case when found then 'ok' else 'not_allowed' end;
end;
$$;

-- I miei pass (eventi a cui sono iscritto, non ancora finiti).
create or replace function public.event_my_passes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.event_card(e) || jsonb_build_object('pass', ep.pass_token, 'my_status', ep.status) order by e.starts_at), '[]'::jsonb)
  from public.event_participants ep
  join public.events e on e.id = ep.event_id
  where ep.user_id = auth.uid()
    and ep.status in ('registered', 'checked_in')
    and e.status in ('published', 'cancelled')
    and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now() - interval '1 day';
$$;

create or replace function public.event_report(p_event uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or char_length(trim(coalesce(p_reason, ''))) < 5 then
    return 'invalid';
  end if;
  if not exists (select 1 from public.events where id = p_event) then
    return 'not_found';
  end if;
  if exists (select 1 from public.event_reports where event_id = p_event and reporter = auth.uid() and status = 'open') then
    return 'ok';
  end if;
  insert into public.event_reports (event_id, reporter, reason) values (p_event, auth.uid(), left(trim(p_reason), 1000));
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- Permessi
-- ---------------------------------------------------------------------------
revoke all on function public.event_end(public.events) from public;
revoke all on function public.event_people(uuid) from public, anon, authenticated;
revoke all on function public.event_organizer_trusted(uuid) from public, anon, authenticated;
revoke all on function public.events_settle_fees(uuid) from public, anon, authenticated;
revoke all on function public.event_organizer_status(uuid) from public, anon, authenticated;
revoke all on function public.event_validate(jsonb) from public, anon, authenticated;
revoke all on function public.event_my_organizer_status() from public, anon;
revoke all on function public.event_save(uuid, jsonb) from public, anon;
revoke all on function public.event_cancel(uuid) from public, anon;
revoke all on function public.event_my_organized() from public, anon;
revoke all on function public.event_attendees(uuid) from public, anon;
revoke all on function public.event_checkin(uuid, text) from public, anon;
revoke all on function public.event_register(uuid) from public, anon;
revoke all on function public.event_unregister(uuid) from public, anon;
revoke all on function public.event_my_passes() from public, anon;
revoke all on function public.event_report(uuid, text) from public, anon;
grant execute on function public.event_my_organizer_status(), public.event_save(uuid, jsonb), public.event_cancel(uuid),
  public.event_my_organized(), public.event_attendees(uuid), public.event_checkin(uuid, text), public.event_register(uuid),
  public.event_unregister(uuid), public.event_my_passes(), public.event_report(uuid, text) to authenticated;
grant execute on function public.event_list(), public.event_detail(uuid) to anon, authenticated;

-- Pass inquadrato con la fotocamera del telefono (link /events/pass/…):
-- all'organizzatore fa il check-in, al titolare mostra il suo evento.
create or replace function public.event_pass_open(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part public.event_participants%rowtype;
  v_event public.events%rowtype;
begin
  select * into v_part from public.event_participants where pass_token = upper(trim(coalesce(p_token, '')));
  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;
  select * into v_event from public.events where id = v_part.event_id;
  if v_event.organizer_id = auth.uid() then
    return public.event_checkin(v_event.id, v_part.pass_token) || jsonb_build_object('event_id', v_event.id, 'role', 'organizer');
  end if;
  if v_part.user_id = auth.uid() then
    return jsonb_build_object('result', 'owner', 'event_id', v_event.id);
  end if;
  return jsonb_build_object('result', 'not_allowed');
end;
$$;
revoke all on function public.event_pass_open(text) from public, anon;
grant execute on function public.event_pass_open(text) to authenticated;

-- Commissioni da pagare (per il pagamento con carta, letto dal server).
create or replace function public.event_my_fees()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.events_settle_fees(auth.uid());
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'event_id', f.event_id, 'title', e.title, 'amount', f.amount, 'status', f.status,
                                        'participants', f.participants, 'percent', f.percent, 'price', f.price, 'created_at', f.created_at)
                     order by f.created_at desc)
    from public.event_fees f join public.events e on e.id = f.event_id
    where f.organizer_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.event_my_fees() from public, anon;
grant execute on function public.event_my_fees() to authenticated;

-- Punti KU giornalieri anche per Events
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
begin
  if auth.uid() is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events'
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

  if v_rows = 0 then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + 1,
      ku_earned_total = coalesce(ku_earned_total, 0) + 1
  where id = auth.uid()
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;
