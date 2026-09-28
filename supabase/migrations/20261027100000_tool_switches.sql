-- Interruttori Admin per i servizi fuori da /marketplace (Travel, Events,
-- Veritas, Affinity): con lo strumento spento in Admin (marketplace_settings
-- .is_enabled = false) il servizio è sospeso.
--   - Travel ed Events: sola lettura. Si vedono viaggi e pass, ma non si crea,
--     non ci si iscrive, non si entra con un invito, niente spese, modifiche
--     o check-in.
--   - Veritas e Affinity: fermi del tutto.
-- I dati non si toccano: riaccendendo lo strumento torna tutto come prima.
-- Le pagine mostrano "Servizio momentaneamente sospeso"; qui il blocco vale
-- anche per chi chiamasse il database direttamente.

create or replace function public.tool_online(p_tool text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_enabled from public.marketplace_settings where tool_name = p_tool), true);
$$;
revoke all on function public.tool_online(text) from public;
grant execute on function public.tool_online(text) to anon, authenticated, service_role;

create or replace function public.tool_require_online(p_tool text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tool_online(p_tool) then
    raise exception 'suspended' using errcode = 'P0001', hint = p_tool;
  end if;
end;
$$;
revoke all on function public.tool_require_online(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- travel
-- ---------------------------------------------------------------------------

-- trip_create (ultima versione: 20261012100000_travel.sql)
create or replace function public.trip_create(
  p_title text,
  p_destination text,
  p_starts date,
  p_ends date,
  p_emoji text,
  p_checklist text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip uuid;
  v_code text;
  v_i int := 0;
  v_item text;
begin
  perform public.tool_require_online('travel');
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if not exists (select 1 from public.tool_access(v_uid, 'travel') t where t.allowed) then
    return jsonb_build_object('error', 'plan_required');
  end if;
  if coalesce(trim(p_title), '') = '' then
    return jsonb_build_object('error', 'invalid');
  end if;
  if p_starts is not null and p_ends is not null and p_ends < p_starts then
    return jsonb_build_object('error', 'dates');
  end if;
  if (select count(*) from public.trips where creator_id = v_uid and (ends_on is null or ends_on >= current_date)) >= 20 then
    return jsonb_build_object('error', 'too_many');
  end if;

  loop
    v_code := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
    exit when not exists (select 1 from public.trips where invite_code = v_code);
  end loop;

  insert into public.trips (creator_id, title, destination, starts_on, ends_on, cover_emoji, invite_code)
  values (v_uid, left(trim(p_title), 80), nullif(left(trim(coalesce(p_destination, '')), 80), ''), p_starts, p_ends,
          coalesce(nullif(left(trim(coalesce(p_emoji, '')), 8), ''), '✈️'), v_code)
  returning id into v_trip;

  insert into public.trip_members (trip_id, user_id, role) values (v_trip, v_uid, 'owner');

  foreach v_item in array coalesce(p_checklist, '{}') loop
    if coalesce(trim(v_item), '') <> '' and v_i < 40 then
      insert into public.trip_checklist (trip_id, title, position) values (v_trip, left(trim(v_item), 120), v_i);
      v_i := v_i + 1;
    end if;
  end loop;

  return jsonb_build_object('id', v_trip);
end;
$$;

-- trip_join (ultima versione: 20261027100000_tool_switches.sql)
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
  perform public.tool_require_online('travel');
  perform public.tool_require_online('travel');
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

-- trip_remove_member (ultima versione: 20261027100000_tool_switches.sql)
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
  perform public.tool_require_online('travel');
  perform public.tool_require_online('travel');
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

-- trip_rotate_code (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.trip_rotate_code(p_trip uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  perform public.tool_require_online('travel');
  perform public.tool_require_online('travel');
  if not public.trip_is_owner(p_trip, auth.uid()) then
    return null;
  end if;
  v_code := public.trip_new_code();
  update public.trips set invite_code = v_code where id = p_trip;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

-- event_save (ultima versione: 20261027100000_tool_switches.sql)
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
  perform public.tool_require_online('events');
  perform public.tool_require_online('events');
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

-- event_register (ultima versione: 20261027100000_tool_switches.sql)
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
  perform public.tool_require_online('events');
  perform public.tool_require_online('events');
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

-- event_unregister (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.event_unregister(p_event uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('events');
  perform public.tool_require_online('events');
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

-- event_checkin (ultima versione: 20261027100000_tool_switches.sql)
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
  perform public.tool_require_online('events');
  perform public.tool_require_online('events');
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

-- event_review (ultima versione: 20261027100000_tool_switches.sql)
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
  perform public.tool_require_online('events');
  perform public.tool_require_online('events');
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

-- event_cancel (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.event_cancel(p_event uuid, p_following boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  perform public.tool_require_online('events');
  perform public.tool_require_online('events');
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

-- ---------------------------------------------------------------------------
-- veritas
-- ---------------------------------------------------------------------------

-- veritas_create_room (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.veritas_create_room(p_nickname text, p_locale text, p_rounds int default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_room uuid;
  v_player uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  perform public.tool_require_online('veritas');
  perform public.tool_require_online('veritas');
  loop
    v_code := substr(translate(upper(encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'base64')), '+/=0O1IL', ''), 1, 6);
    exit when char_length(v_code) = 6 and not exists (select 1 from public.veritas_rooms where code = v_code);
  end loop;
  insert into public.veritas_rooms (code, locale, host_user_id, total_rounds)
  values (
    v_code,
    case when p_locale in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru') then p_locale else 'it' end,
    auth.uid(),
    least(greatest(coalesce(p_rounds, 5), 1), 10)
  )
  returning id into v_room;
  insert into public.veritas_players (room_id, token_hash, nickname, user_id)
  values (v_room, public.veritas_hash(v_token), public.veritas_unique_nickname(v_room, p_nickname), auth.uid())
  returning id into v_player;
  update public.veritas_rooms set host_player_id = v_player where id = v_room;
  return jsonb_build_object('code', v_code, 'room_id', v_room, 'player_id', v_player, 'token', v_token);
end;
$$;

-- veritas_join (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.veritas_join(p_code text, p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.veritas_rooms%rowtype;
  v_player uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  perform public.tool_require_online('veritas');
  perform public.tool_require_online('veritas');
  select * into v_room from public.veritas_rooms where code = upper(trim(p_code)) for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_room.status <> 'lobby' then
    return jsonb_build_object('error', 'started');
  end if;
  if (select count(*) from public.veritas_players where room_id = v_room.id) >= 8 then
    return jsonb_build_object('error', 'full');
  end if;
  insert into public.veritas_players (room_id, token_hash, nickname, user_id)
  values (v_room.id, public.veritas_hash(v_token), public.veritas_unique_nickname(v_room.id, p_nickname), auth.uid())
  returning id into v_player;
  perform public.veritas_signal(v_room.id);
  return jsonb_build_object('room_id', v_room.id, 'player_id', v_player, 'token', v_token);
end;
$$;

-- veritas_start (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.veritas_start(p_room uuid, p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.veritas_player(p_room, p_token);
  v_room public.veritas_rooms%rowtype;
begin
  perform public.tool_require_online('veritas');
  perform public.tool_require_online('veritas');
  select * into v_room from public.veritas_rooms where id = p_room for update;
  if v_me is null or v_room.host_player_id <> v_me then
    return 'not_host';
  end if;
  if v_room.status not in ('lobby', 'finished') then
    return 'already_started';
  end if;
  if (select count(*) from public.veritas_players where room_id = p_room) < 3 then
    return 'need_players';
  end if;
  -- Nuova partita nella stessa stanza: punteggi e turni azzerati.
  update public.veritas_players set score = 0 where room_id = p_room;
  update public.veritas_rooms set round = 0 where id = p_room;
  perform public.veritas_start_round(p_room);
  perform public.veritas_signal(p_room);
  return 'ok';
end;
$$;

-- veritas_answer (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.veritas_answer(p_room uuid, p_token text, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.veritas_player(p_room, p_token);
  v_room public.veritas_rooms%rowtype;
begin
  perform public.tool_require_online('veritas');
  perform public.tool_require_online('veritas');
  if v_me is null then
    return 'not_player';
  end if;
  select * into v_room from public.veritas_rooms where id = p_room;
  if v_room.status <> 'writing' or now() > v_room.phase_ends_at + interval '3 seconds' then
    return 'closed';
  end if;
  if nullif(trim(coalesce(p_body, '')), '') is null then
    return 'empty';
  end if;
  insert into public.veritas_answers (room_id, round, player_id, body)
  values (p_room, v_room.round, v_me, left(trim(p_body), 280))
  on conflict (room_id, round, player_id) do update set body = excluded.body, created_at = now();
  perform public.veritas_signal(p_room);
  perform public.veritas_advance(p_room);
  return 'ok';
end;
$$;

-- veritas_vote (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.veritas_vote(p_room uuid, p_token text, p_slot int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.veritas_player(p_room, p_token);
  v_room public.veritas_rooms%rowtype;
  v_target uuid;
begin
  perform public.tool_require_online('veritas');
  perform public.tool_require_online('veritas');
  if v_me is null then
    return 'not_player';
  end if;
  select * into v_room from public.veritas_rooms where id = p_room;
  if v_room.status <> 'voting' or now() > v_room.phase_ends_at + interval '3 seconds' then
    return 'closed';
  end if;
  if not exists (select 1 from public.veritas_answers where room_id = p_room and round = v_room.round and player_id = v_me) then
    return 'no_answer';
  end if;
  select s.player_id into v_target from (
    select a.player_id, row_number() over (order by md5(a.player_id::text || v_room.id::text || v_room.round::text)) as slot
    from public.veritas_answers a where a.room_id = p_room and a.round = v_room.round
  ) s where s.slot = p_slot;
  if v_target is null or v_target = v_me then
    return 'invalid';
  end if;
  insert into public.veritas_votes (room_id, round, voter_id, target_id)
  values (p_room, v_room.round, v_me, v_target)
  on conflict (room_id, round, voter_id) do update set target_id = excluded.target_id, created_at = now();
  perform public.veritas_signal(p_room);
  perform public.veritas_advance(p_room);
  return 'ok';
end;
$$;

-- veritas_advance (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.veritas_advance(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.veritas_rooms%rowtype;
  v_players int;
  v_answers int;
  v_votes int;
  v_liar_answered boolean;
begin
  perform public.tool_require_online('veritas');
  perform public.tool_require_online('veritas');
  select * into v_room from public.veritas_rooms where id = p_room for update;
  if not found then
    return;
  end if;
  select count(*) into v_players from public.veritas_players where room_id = p_room;

  if v_room.status = 'writing' then
    select count(*) into v_answers from public.veritas_answers where room_id = p_room and round = v_room.round;
    if v_answers >= v_players or now() >= v_room.phase_ends_at then
      v_liar_answered := exists (
        select 1 from public.veritas_answers where room_id = p_room and round = v_room.round and player_id = v_room.liar_player_id
      );
      if v_answers < 2 or not v_liar_answered then
        -- Turno non valido (bugiardo o troppi assenti): si mostra e si prosegue senza punti.
        update public.veritas_rooms
        set status = 'reveal', phase_ends_at = now() + make_interval(secs => public.veritas_seconds('veritas_reveal_seconds', 15)), updated_at = now()
        where id = p_room;
      else
        update public.veritas_rooms
        set status = 'voting', phase_ends_at = now() + make_interval(secs => public.veritas_seconds('veritas_vote_seconds', 45)), updated_at = now()
        where id = p_room;
      end if;
      perform public.veritas_signal(p_room);
    end if;
  elsif v_room.status = 'voting' then
    select count(*) into v_answers from public.veritas_answers where room_id = p_room and round = v_room.round;
    select count(*) into v_votes from public.veritas_votes where room_id = p_room and round = v_room.round;
    -- Votano tutti quelli che hanno risposto
    if v_votes >= v_answers or now() >= v_room.phase_ends_at then
      perform public.veritas_score_round(p_room);
      update public.veritas_rooms
      set status = 'reveal', phase_ends_at = now() + make_interval(secs => public.veritas_seconds('veritas_reveal_seconds', 15)), updated_at = now()
      where id = p_room;
      perform public.veritas_signal(p_room);
    end if;
  elsif v_room.status = 'reveal' and now() >= v_room.phase_ends_at then
    if v_room.round >= v_room.total_rounds then
      update public.veritas_rooms set status = 'finished', phase_ends_at = null, updated_at = now() where id = p_room;
    else
      perform public.veritas_start_round(p_room);
    end if;
    perform public.veritas_signal(p_room);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- affinity
-- ---------------------------------------------------------------------------

-- affinity_set_friends (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.affinity_set_friends(p_on boolean, p_bio text, p_languages text[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  perform public.tool_require_online('affinity');
  perform public.tool_require_online('affinity');
  if v_uid is null then
    return 'blocked';
  end if;
  v_status := coalesce(public.affinity_friends_status(v_uid), 'blocked');
  if p_on and v_status <> 'ok' then
    return v_status;
  end if;
  update public.affinity_profiles
  set opt_friends = p_on,
      bio = nullif(left(trim(coalesce(p_bio, '')), 160), ''),
      languages = coalesce((
        select array_agg(l) from unnest(coalesce(p_languages, '{}')) l
        where l = any (array['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'])
      ), '{}'),
      opted_in_at = case when p_on then coalesce(opted_in_at, now()) else opted_in_at end,
      updated_at = now()
  where user_id = v_uid;
  return case when found then 'ok' else 'no_map' end;
end;
$$;

-- affinity_respond (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.affinity_respond(p_intro uuid, p_yes boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_intro public.affinity_intros%rowtype;
  v_resp text := case when p_yes then 'yes' else 'no' end;
begin
  perform public.tool_require_online('affinity');
  perform public.tool_require_online('affinity');
  select * into v_intro from public.affinity_intros where id = p_intro and v_uid in (user_a, user_b);
  if not found then
    return 'not_found';
  end if;
  if public.affinity_friends_status(v_uid) <> 'ok' then
    return 'not_eligible';
  end if;
  if v_intro.user_a = v_uid then
    update public.affinity_intros set a_response = v_resp where id = p_intro returning * into v_intro;
    return case when v_resp = 'yes' and v_intro.b_response = 'yes' then 'match' else 'ok' end;
  end if;
  update public.affinity_intros set b_response = v_resp where id = p_intro returning * into v_intro;
  return case when v_resp = 'yes' and v_intro.a_response = 'yes' then 'match' else 'ok' end;
end;
$$;

-- affinity_send (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.affinity_send(p_intro uuid, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new boolean;
  v_sent int;
  v_max int;
begin
  perform public.tool_require_online('affinity');
  perform public.tool_require_online('affinity');
  if not public.affinity_is_match(p_intro, v_uid) then
    return 'not_match';
  end if;
  if public.affinity_friends_status(v_uid) <> 'ok' then
    return 'not_eligible';
  end if;
  if nullif(trim(coalesce(p_body, '')), '') is null then
    return 'empty';
  end if;
  select created_at > now() - interval '30 days' into v_new from public.profiles where id = v_uid;
  v_max := case when coalesce(v_new, true) then 20 else 200 end;
  select count(*) into v_sent from public.affinity_messages
  where sender_id = v_uid and created_at > now() - interval '1 day';
  if v_sent >= v_max then
    return 'rate_limited';
  end if;
  insert into public.affinity_messages (intro_id, sender_id, body) values (p_intro, v_uid, left(trim(p_body), 1000));
  return 'ok';
end;
$$;

-- affinity_chat (ultima versione: 20261027100000_tool_switches.sql)
create or replace function public.affinity_chat(p_intro uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform public.tool_require_online('affinity');
  perform public.tool_require_online('affinity');
  if not public.affinity_is_match(p_intro, v_uid) then
    return null;
  end if;
  update public.affinity_messages set read_at = now()
  where intro_id = p_intro and sender_id <> v_uid and read_at is null;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.sender_id = v_uid, 'body', m.body, 'created_at', m.created_at) order by m.created_at)
    from (select * from public.affinity_messages where intro_id = p_intro order by created_at desc limit 200) m
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Scritture dirette (RLS): Travel in sola lettura, Affinity ferma
-- ---------------------------------------------------------------------------
drop policy if exists trips_online_insert on public.trips;
create policy trips_online_insert on public.trips as restrictive for insert to authenticated
  with check (public.tool_online('travel'));
drop policy if exists trips_online_update on public.trips;
create policy trips_online_update on public.trips as restrictive for update to authenticated
  using (public.tool_online('travel'));
drop policy if exists trips_online_delete on public.trips;
create policy trips_online_delete on public.trips as restrictive for delete to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_activities_online_insert on public.trip_activities;
create policy trip_activities_online_insert on public.trip_activities as restrictive for insert to authenticated
  with check (public.tool_online('travel'));
drop policy if exists trip_activities_online_update on public.trip_activities;
create policy trip_activities_online_update on public.trip_activities as restrictive for update to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_activities_online_delete on public.trip_activities;
create policy trip_activities_online_delete on public.trip_activities as restrictive for delete to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_checklist_online_insert on public.trip_checklist;
create policy trip_checklist_online_insert on public.trip_checklist as restrictive for insert to authenticated
  with check (public.tool_online('travel'));
drop policy if exists trip_checklist_online_update on public.trip_checklist;
create policy trip_checklist_online_update on public.trip_checklist as restrictive for update to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_checklist_online_delete on public.trip_checklist;
create policy trip_checklist_online_delete on public.trip_checklist as restrictive for delete to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_expenses_online_insert on public.trip_expenses;
create policy trip_expenses_online_insert on public.trip_expenses as restrictive for insert to authenticated
  with check (public.tool_online('travel'));
drop policy if exists trip_expenses_online_update on public.trip_expenses;
create policy trip_expenses_online_update on public.trip_expenses as restrictive for update to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_expenses_online_delete on public.trip_expenses;
create policy trip_expenses_online_delete on public.trip_expenses as restrictive for delete to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_settlements_online_insert on public.trip_settlements;
create policy trip_settlements_online_insert on public.trip_settlements as restrictive for insert to authenticated
  with check (public.tool_online('travel'));
drop policy if exists trip_settlements_online_update on public.trip_settlements;
create policy trip_settlements_online_update on public.trip_settlements as restrictive for update to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_settlements_online_delete on public.trip_settlements;
create policy trip_settlements_online_delete on public.trip_settlements as restrictive for delete to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_documents_online_insert on public.trip_documents;
create policy trip_documents_online_insert on public.trip_documents as restrictive for insert to authenticated
  with check (public.tool_online('travel'));
drop policy if exists trip_documents_online_update on public.trip_documents;
create policy trip_documents_online_update on public.trip_documents as restrictive for update to authenticated
  using (public.tool_online('travel'));
drop policy if exists trip_documents_online_delete on public.trip_documents;
create policy trip_documents_online_delete on public.trip_documents as restrictive for delete to authenticated
  using (public.tool_online('travel'));
drop policy if exists affinity_profiles_online_insert on public.affinity_profiles;
create policy affinity_profiles_online_insert on public.affinity_profiles as restrictive for insert to authenticated
  with check (public.tool_online('affinity'));
drop policy if exists affinity_profiles_online_update on public.affinity_profiles;
create policy affinity_profiles_online_update on public.affinity_profiles as restrictive for update to authenticated
  using (public.tool_online('affinity'));
