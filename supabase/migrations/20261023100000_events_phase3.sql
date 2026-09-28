-- KUMANI Events — Fase 3: eventi ricorrenti (serie di date indipendenti),
-- timbro Kumi Card automatico al check-in e dati per la fascia "Prossimi
-- eventi" della Home (event_list, già pubblica).
--
-- Serie: alla creazione l'organizzatore sceglie "ogni settimana / ogni 2
-- settimane / ogni mese" e il numero di date (2-12). Ogni data è un evento a
-- sé (iscrizioni, lista d'attesa, check-in, recensioni, commissioni) con lo
-- stesso series_id. Le date si calcolano nell'ora locale dell'evento, così
-- l'orario resta lo stesso anche a cavallo dell'ora legale.
--
-- Kumi Card: se l'organizzatore ha una Kumi Card attiva può far dare un
-- timbro a chi entra. Le tessere Kumi Card normalmente non sono legate a un
-- account (link segreto nel browser): per i partecipanti degli eventi la
-- tessera si crea e si ritrova tramite fidelity_members.user_id.

-- ---------------------------------------------------------------------------
-- Colonne
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists series_id uuid;
alter table public.events add column if not exists fidelity_stamp boolean not null default false;
create index if not exists idx_events_series on public.events(series_id, starts_at) where series_id is not null;

-- Esito del timbro Kumi Card al check-in (ok, too_soon, full, inactive…)
alter table public.event_participants add column if not exists stamp_status text;

alter table public.fidelity_members add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists idx_fid_members_card_user on public.fidelity_members(card_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- Kumi Card dell'organizzatore (solo se attiva e con lo strumento nel piano)
-- ---------------------------------------------------------------------------
create or replace function public.event_fidelity_card(p_uid uuid)
returns public.fidelity_cards
language sql
stable
security definer
set search_path = public
as $$
  select c.* from public.fidelity_cards c
  where c.owner_id = p_uid
    and c.is_active
    and public.user_has_active_subscription(p_uid)
    and exists (select 1 from public.tool_access(p_uid, 'fidelity') t where t.allowed);
$$;
revoke all on function public.event_fidelity_card(uuid) from public, anon, authenticated;

-- Timbro al partecipante: trova (o crea) la sua tessera legata all'account e
-- applica le regole della Kumi Card (ore minime tra timbri, tessera piena…).
create or replace function public.event_stamp_participant(p_event uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_card public.fidelity_cards%rowtype;
  v_member uuid;
  v_code text;
  v_name text;
  v_status text;
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  select * into v_event from public.events where id = p_event;
  if v_event.id is null or not v_event.fidelity_stamp then
    return null;
  end if;
  select * into v_card from public.event_fidelity_card(v_event.organizer_id);
  if v_card.id is null then
    return 'inactive';
  end if;
  select id into v_member from public.fidelity_members where card_id = v_card.id and user_id = p_user;
  if v_member is null then
    loop
      select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '') into v_code
      from generate_series(1, 8);
      exit when not exists (select 1 from public.fidelity_members where member_code = v_code);
    end loop;
    select nullif(trim(coalesce(first_name, '') || ' ' || left(coalesce(last_name, ''), 1)
                  || case when coalesce(last_name, '') <> '' then '.' else '' end), '')
      into v_name from public.profiles where id = p_user;
    insert into public.fidelity_members (card_id, token, member_code, user_id, customer_name)
    values (v_card.id, replace(gen_random_uuid()::text, '-', ''), v_code, p_user, left(v_name, 60))
    on conflict (card_id, user_id) where user_id is not null do nothing
    returning id into v_member;
    if v_member is null then
      select id into v_member from public.fidelity_members where card_id = v_card.id and user_id = p_user;
    end if;
  end if;
  select f.status into v_status from public.fidelity_apply(v_card.id, v_member, 'stamp', 1) f;
  return v_status;
end;
$$;
revoke all on function public.event_stamp_participant(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stato organizzatore: + Kumi Card disponibile
-- ---------------------------------------------------------------------------
create or replace function public.event_organizer_status(p_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats jsonb;
  v_level text;
  v_card public.fidelity_cards%rowtype;
begin
  perform public.events_settle_fees(p_uid);
  v_stats := public.event_organizer_stats(p_uid);
  v_level := v_stats ->> 'level';
  select * into v_card from public.event_fidelity_card(p_uid);
  return public.convivio_leader_checks(p_uid) || v_stats || jsonb_build_object(
    'terms', exists (select 1 from public.profiles where id = p_uid and events_terms_at is not null),
    'verified', public.event_is_verified(p_uid),
    'plan', exists (select 1 from public.tool_access(p_uid, 'events') t where t.allowed),
    'trusted', v_level in ('trusted', 'super'),
    'max_capacity', case v_level when 'super' then 300 when 'trusted' then 100 else 20 end,
    'fees_due', coalesce((select sum(amount) from public.event_fees where organizer_id = p_uid and status = 'due'), 0),
    'fee_percent', case when v_level = 'super'
      then coalesce(nullif(public.setting_text('events_fee_percent_super'), '')::numeric, 3)
      else coalesce(nullif(public.setting_text('events_fee_percent'), '')::numeric, 5) end,
    'fidelity_card', case when v_card.id is not null
      then jsonb_build_object('business_name', v_card.business_name, 'prize', v_card.prize, 'stamps_needed', v_card.stamps_needed) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheda pubblica: + serie e Kumi Card
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
    'organizer_reviews', (select count(*) from public.event_reviews r where r.organizer_id = p_event.organizer_id),
    'series_id', p_event.series_id,
    'fidelity_stamp', p_event.fidelity_stamp,
    'fidelity_business', case when p_event.fidelity_stamp
      then (select c.business_name from public.event_fidelity_card(p_event.organizer_id) c) end
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

-- ---------------------------------------------------------------------------
-- Check-in con timbro Kumi Card
-- ---------------------------------------------------------------------------
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
  v_stamp text;
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
  if not found or v_part.status in ('cancelled', 'waitlist') then
    return jsonb_build_object('result', 'invalid');
  end if;
  select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_name from public.profiles where id = v_part.user_id;
  if v_part.status = 'checked_in' then
    return jsonb_build_object('result', 'already', 'name', v_name, 'at', v_part.checked_in_at, 'stamp', v_part.stamp_status);
  end if;
  update public.event_participants set status = 'checked_in', checked_in_at = now() where id = v_part.id;
  if v_event.fidelity_stamp then
    begin
      v_stamp := public.event_stamp_participant(p_event, v_part.user_id);
    exception when others then
      -- Il check-in vale comunque: il timbro è un di più
      v_stamp := 'error';
    end;
    update public.event_participants set stamp_status = v_stamp where id = v_part.id;
  end if;
  return jsonb_build_object('result', 'ok', 'name', v_name, 'stamp', v_stamp);
end;
$$;

-- ---------------------------------------------------------------------------
-- Annullamento: una data o anche le successive della serie
-- ---------------------------------------------------------------------------
drop function if exists public.event_cancel(uuid);
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
    and coalesce(ends_at, starts_at + interval '3 hours') > now();
  if not found then
    return 'not_allowed';
  end if;
  update public.events set status = 'cancelled', updated_at = now()
  where organizer_id = v_event.organizer_id and status in ('pending', 'published')
    and coalesce(ends_at, starts_at + interval '3 hours') > now()
    and (id = p_event or (p_following and v_event.series_id is not null and series_id = v_event.series_id and starts_at > v_event.starts_at));
  return 'ok';
end;
$$;
revoke all on function public.event_cancel(uuid, boolean) from public, anon;
grant execute on function public.event_cancel(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Salvataggio: serie di date, timbro Kumi Card, modifiche a tutta la serie
-- ---------------------------------------------------------------------------
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
    status = case when v_trusted then v_existing.status else 'pending' end,
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
  return jsonb_build_object('id', p_event, 'status', case when v_trusted then v_existing.status else 'pending' end);
end;
$$;
