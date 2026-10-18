-- Chi crea può partecipare a quello che ha creato.
-- KORDATA: il capocordata può aderire alla sua Kordata con la sua quantità:
-- conta tra gli aderenti, per il minimo e nella quota del fornitore. Resta
-- bloccato solo il fornitore (sull'offerta propria venderebbe a sé stesso).
-- Nell'elenco dei partecipanti la sua riga ha is_leader.
-- EVENTI: chi organizza può iscriversi al proprio evento e occupa un posto.
-- Il prezzo si blocca solo con le iscrizioni degli altri, e la quota KUMANI
-- non conta chi organizza.

CREATE OR REPLACE FUNCTION public.convivio_join(p_group uuid, p_quantity integer, p_note text, p_share_phone boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group public.convivio_groups%rowtype;
  v_member boolean;
begin
  perform public.tool_require_online('convivio');
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return 'not_allowed';
  end if;
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found or public.convivio_status(p_group) <> 'open' then
    return 'closed';
  end if;
  -- Il capocordata può aderire anche lui; il fornitore no (venderebbe a sé stesso)
  if v_group.supplier_id = v_uid then
    return 'not_allowed';
  end if;
  v_member := exists (select 1 from public.convivio_pledges where group_id = p_group and user_id = v_uid);
  if not v_member and v_group.max_participants is not null and public.convivio_people(p_group) >= v_group.max_participants then
    return 'full';
  end if;
  insert into public.convivio_pledges (group_id, user_id, quantity, note, share_phone)
  values (p_group, v_uid, least(greatest(coalesce(p_quantity, 1), 1), 50), nullif(left(trim(coalesce(p_note, '')), 200), ''), coalesce(p_share_phone, false))
  on conflict (group_id, user_id) do update set quantity = excluded.quantity, note = excluded.note, share_phone = excluded.share_phone, updated_at = now();
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$function$;

CREATE OR REPLACE FUNCTION public.convivio_detail(p_group uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.convivio_card(g.id, auth.uid()) || jsonb_build_object(
    'description', g.description,
    'pickup_info', case when g.leader_id = auth.uid()
                          or exists (select 1 from public.convivio_pledges where group_id = g.id and user_id = auth.uid())
                          or (g.supplier_id = auth.uid() and g.supplier_status = 'confirmed') then g.pickup_info end,
    'created_at', g.created_at,
    'leader_since', p.created_at,
    'counter_price', g.counter_price,
    'counter_min', g.counter_min,
    'is_member', public.convivio_is_member(g.id, auth.uid()),
    'my_note', (select note from public.convivio_pledges where group_id = g.id and user_id = auth.uid()),
    'my_share_phone', (select share_phone from public.convivio_pledges where group_id = g.id and user_id = auth.uid()),
    'my_reviews', (select coalesce(jsonb_agg(r.target), '[]'::jsonb) from public.convivio_reviews r where r.group_id = g.id and r.reviewer = auth.uid()),
    -- Partecipanti: capocordata e aderenti; il fornitore solo dopo aver
    -- confermato (e il telefono solo di chi lo ha condiviso).
    'participants', case when (g.leader_id = auth.uid() or exists (select 1 from public.convivio_pledges where group_id = g.id and user_id = auth.uid())
                              or (g.supplier_id = auth.uid() and g.supplier_status = 'confirmed')) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', pp.first_name,
        'is_leader', cp.user_id = g.leader_id,
        'quantity', cp.quantity,
        'note', case when g.leader_id = auth.uid() or g.supplier_id = auth.uid() then cp.note end,
        'phone', case when cp.share_phone and g.supplier_id = auth.uid() and g.supplier_status = 'confirmed' then pp.phone end
      ) order by cp.created_at), '[]'::jsonb)
      from public.convivio_pledges cp join public.profiles pp on pp.id = cp.user_id
      where cp.group_id = g.id
    ) else '[]'::jsonb end
  )
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  where g.id = p_group and auth.uid() is not null;
$function$;

-- Persone iscritte a un evento, senza chi lo organizza
create or replace function public.event_people_others(p_event uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.event_participants ep
  join public.events e on e.id = ep.event_id
  where ep.event_id = p_event and ep.status in ('registered', 'checked_in', 'no_show') and ep.user_id <> e.organizer_id;
$$;
revoke all on function public.event_people_others(uuid) from public, anon, authenticated;

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
  -- Chi organizza può iscriversi anche lui: occupa un posto
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
  -- Eventi gratuiti: prezzo chiesto, dichiarazione, prezzo effettivo
  -- (bloccato dopo le prime iscrizioni) e quota fissa attuale
  v_price numeric := greatest(coalesce((p ->> 'price')::numeric, 0), 0);
  v_free_declared boolean := coalesce((p ->> 'free_declared')::boolean, false);
  v_effective_price numeric;
  v_free_fee numeric := public.events_free_fee_now();
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
    -- Evento gratuito: serve la dichiarazione «nessun pagamento»
    if v_price = 0 and not v_free_declared then
      return jsonb_build_object('error', 'free_declaration');
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
        map_link, online_link, languages, capacity, price, is_18plus, kids_friendly, status, fee_percent, series_id, fidelity_stamp,
        free_declared_at, free_fee_eur
      ) values (
        v_uid, left(trim(p ->> 'title'), 100), left(trim(p ->> 'description'), 3000), p ->> 'type', coalesce(p ->> 'mode', 'in_person'),
        (v_local + v_step) at time zone v_tz,
        case when v_duration is not null then ((v_local + v_step) at time zone v_tz) + v_duration end,
        v_tz,
        nullif(left(trim(coalesce(p ->> 'venue_name', '')), 120), ''), nullif(left(trim(coalesce(p ->> 'address', '')), 200), ''),
        nullif(left(trim(coalesce(p ->> 'city', '')), 80), ''), nullif(upper(p ->> 'country_code'), ''),
        nullif(p ->> 'map_link', ''), nullif(p ->> 'online_link', ''), v_langs, v_capacity,
        greatest(coalesce((p ->> 'price')::numeric, 0), 0), coalesce((p ->> 'is_18plus')::boolean, false), coalesce((p ->> 'kids_friendly')::boolean, false),
        v_new_status, (v_status ->> 'fee_percent')::numeric, v_series, v_fidelity,
        case when v_price = 0 then now() end, case when v_price = 0 then v_free_fee else 0 end
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
  -- Prezzo effettivo (bloccato dopo le prime iscrizioni): se è gratuito
  -- serve la dichiarazione anche in modifica
  v_effective_price := case when public.event_people_others(p_event) > 0 then v_existing.price else v_price end;
  if v_effective_price = 0 and not v_free_declared then
    return jsonb_build_object('error', 'free_declaration');
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
    price = case when public.event_people_others(p_event) > 0 then v_existing.price else greatest(coalesce((p ->> 'price')::numeric, 0), 0) end,
    is_18plus = coalesce((p ->> 'is_18plus')::boolean, false),
    kids_friendly = coalesce((p ->> 'kids_friendly')::boolean, false),
    fidelity_stamp = v_fidelity,
    -- Data della prima dichiarazione; null se diventa a pagamento
    free_declared_at = case when v_effective_price = 0 then coalesce(v_existing.free_declared_at, now()) end,
    -- Quota fissa: bloccata con il prezzo dopo le prime iscrizioni
    free_fee_eur = case when public.event_people_others(p_event) > 0 then v_existing.free_fee_eur
                        when v_effective_price = 0 then v_free_fee else 0 end,
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
        price = case when public.event_people_others(v_sibling.id) > 0 then v_sibling.price else greatest(coalesce((p ->> 'price')::numeric, 0), 0) end,
        is_18plus = coalesce((p ->> 'is_18plus')::boolean, false),
        kids_friendly = coalesce((p ->> 'kids_friendly')::boolean, false),
        fidelity_stamp = v_fidelity,
        free_declared_at = case
          when public.event_people_others(v_sibling.id) > 0 and v_sibling.price > 0 then null
          when public.event_people_others(v_sibling.id) > 0 then coalesce(v_sibling.free_declared_at, case when v_free_declared then now() end)
          when v_price = 0 then coalesce(v_sibling.free_declared_at, now())
          else null end,
        free_fee_eur = case when public.event_people_others(v_sibling.id) > 0 then v_sibling.free_fee_eur
                            when v_price = 0 then v_free_fee else 0 end,
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
  select x.id, x.organizer_id, x.people, x.price,
         case when x.price > 0 then x.fee_percent else 0 end,
         case when x.price > 0 then round(x.price * x.people * x.fee_percent / 100, 2)
              else round(x.people * x.free_fee_eur, 2) end
  from (
    select e.*, case
      when exists (select 1 from public.event_participants c where c.event_id = e.id and c.status = 'checked_in' and c.user_id <> e.organizer_id)
        then (select count(*)::int from public.event_participants c where c.event_id = e.id and c.status = 'checked_in' and c.user_id <> e.organizer_id)
      else public.event_people_others(e.id) end as people
    from public.events e
    where e.organizer_id = p_uid
      and e.status = 'published'
      and public.event_end(e) < now()
      and ((e.price > 0 and e.fee_percent > 0) or (e.price = 0 and e.free_fee_eur > 0))
      and not exists (select 1 from public.event_fees f where f.event_id = e.id)
  ) x
  where x.people > 0
  on conflict (event_id) do nothing;
end;
$$;
