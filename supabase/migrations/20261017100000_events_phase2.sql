-- KUMANI Events — Fase 2: lista d'attesa, recensioni dopo l'evento,
-- livelli dell'organizzatore (Nuovo / Fidato / Super) con declassamento,
-- assenze (no-show) e contatore "C'ero".

-- ---------------------------------------------------------------------------
-- Lista d'attesa e recensioni
-- ---------------------------------------------------------------------------
do $$
declare v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid = 'public.event_participants'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%';
  if v_name is not null then
    execute format('alter table public.event_participants drop constraint %I', v_name);
  end if;
end $$;
alter table public.event_participants add constraint event_participants_status_check
  check (status in ('registered', 'waitlist', 'cancelled', 'checked_in', 'no_show'));

create table if not exists public.event_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  reviewer uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, reviewer)
);
create index if not exists idx_event_reviews_organizer on public.event_reviews(organizer_id, created_at desc);
alter table public.event_reviews enable row level security;

insert into public.system_settings (key, value)
values ('events_fee_percent_super', '"3"')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Reputazione e livelli dell'organizzatore
-- ---------------------------------------------------------------------------
create or replace function public.event_organizer_stats(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select
      (select count(*) from public.events e where e.organizer_id = p_uid and e.status = 'published'
         and coalesce(e.ends_at, e.starts_at + interval '3 hours') < now())::int as concluded,
      (select count(*) from public.event_reviews r where r.organizer_id = p_uid)::int as reviews,
      (select round(avg(r.rating)::numeric, 2) from public.event_reviews r where r.organizer_id = p_uid) as avg_rating,
      (select count(*) from public.events e where e.organizer_id = p_uid and e.status = 'banned'
         and e.updated_at > now() - interval '180 days')::int as banned_recent
  )
  select jsonb_build_object(
    'concluded', s.concluded,
    'reviews', s.reviews,
    'avg_rating', s.avg_rating,
    'banned_recent', s.banned_recent,
    'level', case
      -- Declassamento: evento bloccato di recente o media bassa
      when s.banned_recent > 0 or (s.reviews >= 5 and s.avg_rating < 3.5) then 'new'
      when s.concluded >= 10 and s.reviews >= 10 and s.avg_rating >= 4.8 then 'super'
      when s.concluded >= 2 and (s.reviews < 3 or s.avg_rating >= 4.5) then 'trusted'
      else 'new'
    end
  )
  from s;
$$;
revoke all on function public.event_organizer_stats(uuid) from public, anon, authenticated;

create or replace function public.event_organizer_level(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.event_organizer_stats(p_uid) ->> 'level';
$$;
revoke all on function public.event_organizer_level(uuid) from public, anon, authenticated;

-- "Fidato" (pubblica senza approvazione) vale anche per i Super Organizer.
create or replace function public.event_organizer_trusted(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.event_organizer_level(p_uid) in ('trusted', 'super');
$$;

-- Assenze: a evento concluso, se l'organizzatore ha usato il check-in, chi
-- era iscritto e non è entrato diventa "assente". Poi le commissioni.
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
declare
  v_stats jsonb;
  v_level text;
begin
  perform public.events_settle_fees(p_uid);
  v_stats := public.event_organizer_stats(p_uid);
  v_level := v_stats ->> 'level';
  return public.convivio_leader_checks(p_uid) || v_stats || jsonb_build_object(
    'terms', exists (select 1 from public.profiles where id = p_uid and events_terms_at is not null),
    'verified', public.event_is_verified(p_uid),
    'plan', exists (select 1 from public.tool_access(p_uid, 'events') t where t.allowed),
    'trusted', v_level in ('trusted', 'super'),
    'max_capacity', case v_level when 'super' then 300 when 'trusted' then 100 else 20 end,
    'fees_due', coalesce((select sum(amount) from public.event_fees where organizer_id = p_uid and status = 'due'), 0),
    'fee_percent', case when v_level = 'super'
      then coalesce(nullif(public.setting_text('events_fee_percent_super'), '')::numeric, 3)
      else coalesce(nullif(public.setting_text('events_fee_percent'), '')::numeric, 5) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheda pubblica con reputazione e lista d'attesa
-- ---------------------------------------------------------------------------
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
    'waitlist', (select count(*) from public.event_participants w where w.event_id = p_event.id and w.status = 'waitlist'),
    'price', p_event.price,
    'currency', p_event.currency,
    'is_18plus', p_event.is_18plus,
    'kids_friendly', p_event.kids_friendly,
    'status', p_event.status,
    'ended', public.event_end(p_event) < now(),
    'organizer_name', (select coalesce(nullif(trim(first_name), ''), '—') from public.profiles where id = p_event.organizer_id),
    'organizer_referral', (select referral_code from public.profiles where id = p_event.organizer_id),
    'organizer_trusted', public.event_organizer_trusted(p_event.organizer_id),
    'organizer_level', public.event_organizer_level(p_event.organizer_id),
    'organizer_rating', (select round(avg(r.rating)::numeric, 1) from public.event_reviews r where r.organizer_id = p_event.organizer_id),
    'organizer_reviews', (select count(*) from public.event_reviews r where r.organizer_id = p_event.organizer_id)
  );
$$;
revoke all on function public.event_card(public.events) from public, anon, authenticated;

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
  if v_event.status <> 'published' and not v_is_organizer and not (v_found and v_event.status = 'cancelled') then
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
    -- Recensione: a evento concluso (entro 30 giorni), da chi è entrato
    -- (o da chi era iscritto, se l'organizzatore non ha usato il check-in)
    'can_review', v_found and not v_is_organizer
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
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Iscrizione con lista d'attesa
-- ---------------------------------------------------------------------------
create or replace function public.event_promote_waitlist(p_event uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_promoted int := 0;
  v_next uuid;
begin
  select capacity into v_capacity from public.events where id = p_event and status = 'published' and starts_at > now();
  if v_capacity is null then
    return 0;
  end if;
  loop
    exit when public.event_people(p_event) >= v_capacity;
    select id into v_next from public.event_participants
    where event_id = p_event and status = 'waitlist' order by created_at limit 1 for update skip locked;
    exit when v_next is null;
    update public.event_participants set status = 'registered' where id = v_next;
    v_promoted := v_promoted + 1;
    v_next := null;
  end loop;
  return v_promoted;
end;
$$;
revoke all on function public.event_promote_waitlist(uuid) from public, anon, authenticated;

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
  v_status := case when public.event_people(p_event) >= v_event.capacity then 'waitlist' else 'registered' end;
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

-- Annullare l'iscrizione (o uscire dalla lista d'attesa): il primo in lista
-- d'attesa prende subito il posto.
create or replace function public.event_unregister(p_event uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_participants ep set status = 'cancelled'
  from public.events e
  where ep.event_id = p_event and ep.user_id = auth.uid() and ep.status in ('registered', 'waitlist')
    and e.id = ep.event_id and e.starts_at > now();
  if not found then
    return 'not_allowed';
  end if;
  perform public.event_promote_waitlist(p_event);
  return 'ok';
end;
$$;

-- Pass e lista d'attesa (eventi non ancora finiti).
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
    and e.status in ('published', 'cancelled')
    and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now() - interval '1 day';
$$;

-- "C'ero": eventi a cui sono davvero entrato.
create or replace function public.event_my_attended()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.event_participants where user_id = auth.uid() and status = 'checked_in';
$$;

-- Iscritti per l'organizzatore, con la lista d'attesa e le assenze passate
-- di ciascuno (affidabilità).
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
    'code', right(ep.pass_token, 6),
    'no_shows', (select count(*) from public.event_participants o where o.user_id = ep.user_id and o.status = 'no_show' and o.event_id <> ep.event_id),
    'attended', (select count(*) from public.event_participants o where o.user_id = ep.user_id and o.status = 'checked_in' and o.event_id <> ep.event_id)
  ) order by case ep.status when 'waitlist' then 1 else 0 end, ep.created_at), '[]'::jsonb)
  from public.event_participants ep
  join public.profiles pr on pr.id = ep.user_id
  join public.events e on e.id = ep.event_id
  where ep.event_id = p_event and e.organizer_id = auth.uid() and ep.status <> 'cancelled';
$$;

-- Recensione dell'evento e dell'organizzatore (modificabile).
create or replace function public.event_review(p_event uuid, p_rating int, p_comment text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_detail jsonb;
  v_organizer uuid;
begin
  if auth.uid() is null or p_rating is null or p_rating < 1 or p_rating > 5 then
    return 'invalid';
  end if;
  v_detail := public.event_detail(p_event);
  if v_detail is null or not coalesce((v_detail ->> 'can_review')::boolean, false) then
    return 'not_allowed';
  end if;
  select organizer_id into v_organizer from public.events where id = p_event;
  insert into public.event_reviews (event_id, organizer_id, reviewer, rating, comment)
  values (p_event, v_organizer, auth.uid(), p_rating, nullif(left(trim(coalesce(p_comment, '')), 500), ''))
  on conflict (event_id, reviewer) do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
  return 'ok';
end;
$$;

revoke all on function public.event_my_attended() from public, anon;
revoke all on function public.event_review(uuid, int, text) from public, anon;
grant execute on function public.event_my_attended(), public.event_review(uuid, int, text) to authenticated;

-- Posti massimi secondo il livello (20 / 100 / 300) e lista d'attesa dopo le modifiche
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
  v_max := coalesce((v_status ->> 'max_capacity')::int, case when v_trusted then 100 else 20 end);
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
  -- Più posti: chi è in lista d'attesa entra subito
  perform public.event_promote_waitlist(p_event);
  return jsonb_build_object('id', p_event, 'status', case when v_trusted then v_existing.status else 'pending' end);
end;
$$;
