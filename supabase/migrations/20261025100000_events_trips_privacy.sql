-- Controllo Travel/Events: privacy delle letture dirette.
--
-- 1. events: la policy events_select lascia leggere a ogni utente loggato le
--    righe degli eventi pubblicati. Con il select su tutte le colonne, chiunque
--    poteva leggere dal browser indirizzo esatto, link della mappa e link
--    online, che devono arrivare solo a iscritti e organizzatore (tramite
--    event_detail). Il select diretto resta solo sulle colonne non riservate
--    (usate da agenda e wallet); il resto passa dalle funzioni event_*.

revoke select on public.events from anon, authenticated;
grant select (
  id, organizer_id, title, description, type, mode, starts_at, ends_at, timezone, venue_name, city, country_code,
  languages, capacity, price, currency, is_18plus, kids_friendly, status, created_at, updated_at, series_id, fidelity_stamp
) on public.events to authenticated;

-- 2. Travel: trip_touch leggeva new.trip_id / old.trip_id anche sulla
--    tabella trips, che non ha quella colonna → "record has no field
--    trip_id" a ogni creazione o modifica di un viaggio. Il campo si legge
--    ora dal JSON della riga (vale per tutte le tabelle con il trigger).
create or replace function public.trip_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_trip uuid;
begin
  v_trip := (case when tg_table_name = 'trips' then v_row ->> 'id' else v_row ->> 'trip_id' end)::uuid;
  if v_trip is not null then
    perform public.trip_signal(v_trip);
  end if;
  return null;
end;
$$;

-- 3. Travel: chi esce o viene tolto non rientra con lo stesso codice
--    invito ("potrai rientrare solo con un nuovo invito"). L'organizzatore
--    può generare un nuovo codice (trip_rotate_code).
create table if not exists public.trip_exits (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table public.trip_exits enable row level security;

-- Codici invito nuovi: 10 caratteri senza lettere ambigue (prima 6 cifre
-- esadecimali, troppo facili da indovinare). I codici già dati restano validi.
create or replace function public.trip_new_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '') into v_code
    from generate_series(1, 10);
    exit when not exists (select 1 from public.trips where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function public.trip_new_code() from public, anon, authenticated;

create or replace function public.trips_set_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.invite_code := public.trip_new_code();
  return new;
end;
$$;
drop trigger if exists trips_set_code on public.trips;
create trigger trips_set_code before insert on public.trips
  for each row execute function public.trips_set_code();

create or replace function public.trip_rotate_code(p_trip uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.trip_is_owner(p_trip, auth.uid()) then
    return null;
  end if;
  v_code := public.trip_new_code();
  update public.trips set invite_code = v_code where id = p_trip;
  return v_code;
end;
$$;
revoke all on function public.trip_rotate_code(uuid) from public, anon;
grant execute on function public.trip_rotate_code(uuid) to authenticated;

create or replace function public.trip_remove_member(p_member uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.trip_members%rowtype;
  v_trip public.trips%rowtype;
begin
  select * into v_member from public.trip_members where id = p_member;
  if not found then
    return 'not_found';
  end if;
  -- Blocco sul viaggio: nessuna spesa nuova a metà controllo
  select * into v_trip from public.trips where id = v_member.trip_id for update;
  if v_member.role = 'owner' then
    return 'owner';
  end if;
  if v_member.user_id <> v_uid and v_trip.creator_id is distinct from v_uid then
    return 'not_allowed';
  end if;
  if exists (select 1 from public.trip_expenses e where e.trip_id = v_member.trip_id and (e.paid_by = p_member or p_member = any(e.split_between)))
     or exists (select 1 from public.trip_settlements s where s.trip_id = v_member.trip_id and p_member in (s.from_member, s.to_member)) then
    return 'has_expenses';
  end if;
  delete from public.trip_members where id = p_member;
  insert into public.trip_exits (trip_id, user_id, invite_code) values (v_member.trip_id, v_member.user_id, v_trip.invite_code)
  on conflict (trip_id, user_id) do update set invite_code = excluded.invite_code, created_at = now();
  return 'ok';
end;
$$;

create or replace function public.trip_join(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip public.trips%rowtype;
begin
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  select * into v_trip from public.trips where invite_code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if public.trip_is_member(v_trip.id, v_uid) then
    return jsonb_build_object('id', v_trip.id);
  end if;
  -- Uscito o tolto: serve un codice nuovo
  if exists (select 1 from public.trip_exits x where x.trip_id = v_trip.id and x.user_id = v_uid and x.invite_code = v_trip.invite_code) then
    return jsonb_build_object('error', 'removed');
  end if;
  if v_trip.ends_on is not null and v_trip.ends_on < current_date - 30 then
    return jsonb_build_object('error', 'ended');
  end if;
  if (select count(*) from public.trip_members where trip_id = v_trip.id) >= 20 then
    return jsonb_build_object('error', 'full');
  end if;
  insert into public.trip_members (trip_id, user_id, role) values (v_trip.id, v_uid, 'member')
  on conflict (trip_id, user_id) do nothing;
  delete from public.trip_exits where trip_id = v_trip.id and user_id = v_uid;
  return jsonb_build_object('id', v_trip.id);
end;
$$;

-- 4. Travel, rimborsi: li conferma chi riceve i soldi (o l'organizzatore).
--    Prima anche chi doveva pagare poteva azzerarsi il debito da solo, e chi
--    riceveva non poteva annullare il rimborso.
drop policy if exists trip_settlements_insert on public.trip_settlements;
create policy trip_settlements_insert on public.trip_settlements for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.trip_my_member(trip_id, (select auth.uid())) = to_member
      or public.trip_is_owner(trip_id, (select auth.uid()))
    )
  );
drop policy if exists trip_settlements_delete on public.trip_settlements;
create policy trip_settlements_delete on public.trip_settlements for delete to authenticated
  using (
    created_by = (select auth.uid())
    or public.trip_is_owner(trip_id, (select auth.uid()))
    or public.trip_my_member(trip_id, (select auth.uid())) = to_member
  );

-- 5. Funzioni di controllo di Travel usate dalle policy: non servono a chi
--    non è loggato (evita di sondare chi è membro di quale viaggio).
revoke execute on function public.trip_is_member(uuid, uuid) from anon, public;
revoke execute on function public.trip_is_owner(uuid, uuid) from anon, public;
revoke execute on function public.trip_can_edit(uuid, uuid) from anon, public;
revoke execute on function public.trip_my_member(uuid, uuid) from anon, public;

-- ===========================================================================
-- 6. Events: correzioni dal controllo
-- ===========================================================================

-- a) Fuso orario: solo nomi IANA "Area/Luogo" esistenti (un fuso che il
--    browser non conosce faceva fallire le pagine con le date).

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
  if coalesce(p ->> 'timezone', '') <> '' and (
       (p ->> 'timezone') !~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$'
       or not exists (select 1 from pg_timezone_names where name = p ->> 'timezone')) then
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


-- b) Commissione: se l'organizzatore ha usato il check-in si contano solo
--    le persone entrate (chi non è venuto non ha pagato sul posto).

create or replace function public.events_settle_fees(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_participants ep set status = 'no_show'
  from public.events e
  where e.id = ep.event_id and e.organizer_id = p_uid and ep.status = 'registered'
    and coalesce(e.ends_at, e.starts_at + interval '3 hours') < now()
    and exists (select 1 from public.event_participants c where c.event_id = e.id and c.status = 'checked_in');
  update public.event_participants set status = 'cancelled'
  where status = 'waitlist'
    and event_id in (select id from public.events where organizer_id = p_uid and coalesce(ends_at, starts_at + interval '3 hours') < now());

  insert into public.event_fees (event_id, organizer_id, participants, price, percent, amount)
  select x.id, x.organizer_id, x.people, x.price, x.fee_percent, round(x.price * x.people * x.fee_percent / 100, 2)
  from (
    select e.*, case
      when exists (select 1 from public.event_participants c where c.event_id = e.id and c.status = 'checked_in')
        then (select count(*)::int from public.event_participants c where c.event_id = e.id and c.status = 'checked_in')
      else public.event_people(e.id) end as people
    from public.events e
    where e.organizer_id = p_uid
      and e.status = 'published'
      and public.event_end(e) < now()
      and e.price > 0 and e.fee_percent > 0
      and not exists (select 1 from public.event_fees f where f.event_id = e.id)
  ) x
  where x.people > 0
  on conflict (event_id) do nothing;
end;
$$;


-- c) Iscrizione: se c'è già qualcuno in lista d'attesa, chi arriva dopo si
--    mette in coda (non passa davanti quando si libera un posto).

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
  v_status text;
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
  if v_existing.id is not null and v_existing.status in ('registered', 'checked_in') then
    return jsonb_build_object('pass', v_existing.pass_token);
  end if;
  if v_existing.id is not null and v_existing.status = 'waitlist' then
    return jsonb_build_object('waitlist', true);
  end if;
  v_status := case
    when public.event_people(p_event) >= v_event.capacity
      or exists (select 1 from public.event_participants w where w.event_id = p_event and w.status = 'waitlist') then 'waitlist'
    else 'registered' end;
  loop
    v_token := upper(substring(md5(gen_random_uuid()::text) from 1 for 12));
    exit when not exists (select 1 from public.event_participants where pass_token = v_token);
  end loop;
  if v_existing.id is not null then
    update public.event_participants set status = v_status, pass_token = v_token, checked_in_at = null, created_at = now()
    where id = v_existing.id;
  else
    insert into public.event_participants (event_id, user_id, pass_token, status) values (p_event, v_uid, v_token, v_status);
  end if;
  if v_status = 'waitlist' then
    return jsonb_build_object('waitlist', true);
  end if;
  return jsonb_build_object('pass', v_token);
end;
$$;


-- d) Dettaglio: chi è iscritto continua a vedere l'evento (e il pass) anche
--    se una modifica lo rimanda in approvazione; recensioni solo per eventi
--    pubblicati (non annullati).

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
  v_found boolean;
  v_used_checkin boolean;
begin
  select * into v_event from public.events where id = p_event;
  if not found then
    return null;
  end if;
  v_is_organizer := v_uid is not null and v_event.organizer_id = v_uid;
  select * into v_me from public.event_participants where event_id = p_event and user_id = v_uid;
  v_found := found;
  v_registered := v_found and v_me.status in ('registered', 'checked_in', 'no_show');
  if v_event.status <> 'published' and not v_is_organizer
     and not (v_found and (v_event.status = 'cancelled' or (v_event.status = 'pending' and v_me.status <> 'cancelled'))) then
    return null;
  end if;
  v_used_checkin := exists (select 1 from public.event_participants c where c.event_id = p_event and c.status = 'checked_in');
  return public.event_card(v_event) || jsonb_build_object(
    'is_organizer', v_is_organizer,
    'review_note', case when v_is_organizer then v_event.review_note end,
    'address', case when v_registered or v_is_organizer then v_event.address end,
    'map_link', case when v_registered or v_is_organizer then v_event.map_link end,
    'online_link', case when v_registered or v_is_organizer then v_event.online_link end,
    'my_status', case when v_found then v_me.status end,
    'my_pass', case when v_registered then v_me.pass_token end,
    'my_waitlist_position', case when v_found and v_me.status = 'waitlist' then (
      select count(*) from public.event_participants w
      where w.event_id = p_event and w.status = 'waitlist' and w.created_at <= v_me.created_at
    ) end,
    'fee_percent', case when v_is_organizer then v_event.fee_percent end,
    'can_review', v_found and not v_is_organizer and v_event.status = 'published'
      and public.event_end(v_event) < now() and public.event_end(v_event) > now() - interval '30 days'
      and (v_me.status = 'checked_in' or (v_me.status = 'registered' and not v_used_checkin)),
    'my_review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment) from public.event_reviews r where r.event_id = p_event and r.reviewer = v_uid),
    'reviews', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'rating', x.rating, 'comment', x.comment, 'name', x.name, 'event_title', x.title, 'created_at', x.created_at
      ) order by x.created_at desc), '[]'::jsonb)
      from (
        select r.rating, r.comment, r.created_at, e.title, coalesce(nullif(trim(p.first_name), ''), '—') as name
        from public.event_reviews r
        join public.events e on e.id = r.event_id
        join public.profiles p on p.id = r.reviewer
        where r.organizer_id = v_event.organizer_id
        order by r.created_at desc
        limit 10
      ) x
    ),
    -- Altre date della stessa serie ancora da svolgere
    'series', case when v_event.series_id is not null then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'starts_at', s.starts_at, 'status', s.status, 'people', public.event_people(s.id), 'capacity', s.capacity
      ) order by s.starts_at), '[]'::jsonb)
      from (
        select * from public.events o
        where o.series_id = v_event.series_id and o.id <> v_event.id
          and coalesce(o.ends_at, o.starts_at + interval '3 hours') > now()
          and (o.status = 'published' or (v_is_organizer and o.status in ('pending', 'rejected')))
        order by o.starts_at
        limit 12
      ) s
    ) end,
    -- Kumi Card del partecipante presso l'organizzatore (link /f/…)
    'my_stamp_status', case when v_found then v_me.stamp_status end,
    'my_card_token', case when v_uid is not null and v_event.fidelity_stamp then (
      select m.token from public.fidelity_members m
      join public.fidelity_cards c on c.id = m.card_id
      where c.owner_id = v_event.organizer_id and m.user_id = v_uid
    ) end
  );
end;
$$;

create or replace function public.event_my_passes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.event_card(e) || jsonb_build_object(
    'pass', case when ep.status <> 'waitlist' then ep.pass_token end, 'my_status', ep.status
  ) order by e.starts_at), '[]'::jsonb)
  from public.event_participants ep
  join public.events e on e.id = ep.event_id
  where ep.user_id = auth.uid()
    and ep.status in ('registered', 'checked_in', 'waitlist')
    and e.status in ('published', 'cancelled', 'pending')
    and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now() - interval '1 day';
$$;


-- e) Annullamento solo prima dell'inizio: annullare a evento in corso
--    permetteva di non pagare la commissione su un evento svolto.

create or replace function public.event_cancel(p_event uuid, p_following boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event from public.events
  where id = p_event and organizer_id = auth.uid() and status in ('pending', 'published')
    and starts_at > now();
  if not found then
    return 'not_allowed';
  end if;
  update public.events set status = 'cancelled', updated_at = now()
  where organizer_id = v_event.organizer_id and status in ('pending', 'published')
    and starts_at > now()
    and (id = p_event or (p_following and v_event.series_id is not null and series_id = v_event.series_id and starts_at > v_event.starts_at));
  return 'ok';
end;
$$;


-- f) Modifica: un organizzatore declassato può ancora modificare i suoi eventi
--    già grandi (posti fino al valore attuale); un evento rifiutato di un
--    organizzatore diventato fidato torna in approvazione.

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
  v_first uuid;
  v_existing public.events%rowtype;
  v_repeat text := coalesce(p ->> 'repeat', 'none');
  v_count int := 1;
  v_series uuid;
  v_tz text := coalesce(nullif(p ->> 'timezone', ''), 'Europe/Rome');
  v_start timestamptz;
  v_end timestamptz;
  v_local timestamp;
  v_duration interval;
  v_step interval;
  v_fidelity boolean;
  v_new_status text;
  v_sibling record;
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
  v_new_status := case when v_trusted then 'published' else 'pending' end;
  v_max := coalesce((v_status ->> 'max_capacity')::int, case when v_trusted then 100 else 20 end);
  v_capacity := coalesce((p ->> 'capacity')::int, 0);
  if p_event is not null then
    v_max := greatest(v_max, coalesce((select capacity from public.events where id = p_event and organizer_id = v_uid), 0));
  end if;
  if v_capacity < 1 or v_capacity > v_max then
    return jsonb_build_object('error', 'capacity', 'max', v_max);
  end if;
  select coalesce(array_agg(distinct l), '{}') into v_langs
  from jsonb_array_elements_text(case when jsonb_typeof(p -> 'languages') = 'array' then p -> 'languages' else '[]'::jsonb end) l
  where l in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru');
  if cardinality(v_langs) = 0 then
    return jsonb_build_object('error', 'languages');
  end if;
  -- Timbro Kumi Card solo con una Kumi Card attiva
  v_fidelity := coalesce((p ->> 'fidelity_stamp')::boolean, false) and (v_status -> 'fidelity_card') is not null
                and jsonb_typeof(v_status -> 'fidelity_card') = 'object';

  if p_event is null then
    if (v_status ->> 'fees_due')::numeric >= 0.5 then
      return jsonb_build_object('error', 'fees_due');
    end if;
    if v_repeat not in ('none', 'weekly', 'biweekly', 'monthly') then
      return jsonb_build_object('error', 'invalid');
    end if;
    if v_repeat <> 'none' then
      v_count := coalesce((p ->> 'repeat_count')::int, 0);
      if v_count < 2 or v_count > 12 then
        return jsonb_build_object('error', 'repeat_count');
      end if;
      v_series := gen_random_uuid();
    end if;
    -- Al massimo 30 date in programma (una serie conta per le sue date)
    if (select count(*) from public.events where organizer_id = v_uid and status in ('pending', 'published')
        and coalesce(ends_at, starts_at + interval '3 hours') > now()) + v_count > 30 then
      return jsonb_build_object('error', 'too_many');
    end if;

    v_start := (p ->> 'starts_at')::timestamptz;
    v_end := nullif(p ->> 'ends_at', '')::timestamptz;
    v_duration := v_end - v_start;
    v_local := v_start at time zone v_tz;
    for i in 0 .. v_count - 1 loop
      v_step := case v_repeat
        when 'weekly' then make_interval(days => 7 * i)
        when 'biweekly' then make_interval(days => 14 * i)
        when 'monthly' then make_interval(months => i)
        else interval '0' end;
      insert into public.events (
        organizer_id, title, description, type, mode, starts_at, ends_at, timezone, venue_name, address, city, country_code,
        map_link, online_link, languages, capacity, price, is_18plus, kids_friendly, status, fee_percent, series_id, fidelity_stamp
      ) values (
        v_uid, left(trim(p ->> 'title'), 100), left(trim(p ->> 'description'), 3000), p ->> 'type', coalesce(p ->> 'mode', 'in_person'),
        (v_local + v_step) at time zone v_tz,
        case when v_duration is not null then ((v_local + v_step) at time zone v_tz) + v_duration end,
        v_tz,
        nullif(left(trim(coalesce(p ->> 'venue_name', '')), 120), ''), nullif(left(trim(coalesce(p ->> 'address', '')), 200), ''),
        nullif(left(trim(coalesce(p ->> 'city', '')), 80), ''), nullif(upper(p ->> 'country_code'), ''),
        nullif(p ->> 'map_link', ''), nullif(p ->> 'online_link', ''), v_langs, v_capacity,
        greatest(coalesce((p ->> 'price')::numeric, 0), 0), coalesce((p ->> 'is_18plus')::boolean, false), coalesce((p ->> 'kids_friendly')::boolean, false),
        v_new_status, (v_status ->> 'fee_percent')::numeric, v_series, v_fidelity
      ) returning id into v_id;
      if i = 0 then
        v_first := v_id;
      end if;
    end loop;
    return jsonb_build_object('id', v_first, 'status', v_new_status, 'dates', v_count);
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
    timezone = v_tz,
    venue_name = nullif(left(trim(coalesce(p ->> 'venue_name', '')), 120), ''),
    address = nullif(left(trim(coalesce(p ->> 'address', '')), 200), ''),
    city = nullif(left(trim(coalesce(p ->> 'city', '')), 80), ''),
    country_code = nullif(upper(p ->> 'country_code'), ''),
    map_link = nullif(p ->> 'map_link', ''),
    online_link = nullif(p ->> 'online_link', ''),
    languages = v_langs,
    capacity = v_capacity,
    price = case when public.event_people(p_event) > 0 then v_existing.price else greatest(coalesce((p ->> 'price')::numeric, 0), 0) end,
    is_18plus = coalesce((p ->> 'is_18plus')::boolean, false),
    kids_friendly = coalesce((p ->> 'kids_friendly')::boolean, false),
    fidelity_stamp = v_fidelity,
    status = case when v_trusted then (case when v_existing.status = 'rejected' then 'pending' else v_existing.status end) else 'pending' end,
    review_note = null,
    rules_accepted_at = now(),
    updated_at = now()
  where id = p_event;
  perform public.event_promote_waitlist(p_event);

  -- Stesse modifiche (tranne data e ora) alle date successive della serie
  if coalesce((p ->> 'apply_to_series')::boolean, false) and v_existing.series_id is not null then
    for v_sibling in
      select * from public.events
      where series_id = v_existing.series_id and organizer_id = v_uid and id <> p_event
        and status in ('pending', 'published', 'rejected') and starts_at > v_existing.starts_at
      for update
    loop
      update public.events set
        title = left(trim(p ->> 'title'), 100),
        description = left(trim(p ->> 'description'), 3000),
        type = p ->> 'type',
        mode = coalesce(p ->> 'mode', 'in_person'),
        venue_name = nullif(left(trim(coalesce(p ->> 'venue_name', '')), 120), ''),
        address = nullif(left(trim(coalesce(p ->> 'address', '')), 200), ''),
        city = nullif(left(trim(coalesce(p ->> 'city', '')), 80), ''),
        country_code = nullif(upper(p ->> 'country_code'), ''),
        map_link = nullif(p ->> 'map_link', ''),
        online_link = nullif(p ->> 'online_link', ''),
        languages = v_langs,
        -- Mai sotto gli iscritti di quella data
        capacity = greatest(v_capacity, public.event_people(v_sibling.id)),
        price = case when public.event_people(v_sibling.id) > 0 then v_sibling.price else greatest(coalesce((p ->> 'price')::numeric, 0), 0) end,
        is_18plus = coalesce((p ->> 'is_18plus')::boolean, false),
        kids_friendly = coalesce((p ->> 'kids_friendly')::boolean, false),
        fidelity_stamp = v_fidelity,
        status = case when v_trusted then (case when v_sibling.status = 'rejected' then 'pending' else v_sibling.status end) else 'pending' end,
        review_note = null,
        rules_accepted_at = now(),
        updated_at = now()
      where id = v_sibling.id;
      perform public.event_promote_waitlist(v_sibling.id);
    end loop;
  end if;
  return jsonb_build_object('id', p_event, 'status', (select status from public.events where id = p_event));
end;
$$;


-- g) Lista d'attesa dopo l'approvazione dello Staff (la chiama il server
--    con il client di servizio).
grant execute on function public.event_promote_waitlist(uuid) to service_role;
