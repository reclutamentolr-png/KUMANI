-- KUMANI Events: eventi gratuiti dichiarati.
--
-- L'organizzatore sceglie «Evento gratuito» o «Evento a pagamento». Per un
-- evento gratuito deve dichiarare che ai partecipanti non sarà chiesto alcun
-- pagamento (né all'ingresso né dopo): event_save rifiuta il salvataggio
-- senza dichiarazione e ne salva la data in events.free_declared_at (null per
-- gli eventi a pagamento).
--
-- Quota fissa per iscritto sugli eventi gratuiti: system_settings
-- 'events_free_fee_eur' (default 0 = nessuna commissione). Come la
-- percentuale, ogni evento conserva la quota valida quando è stato salvato
-- gratuito (events.free_fee_eur): cambiarla non tocca gli eventi già creati.
--
-- Segnalazioni: nuovo motivo 'free_paid' («Mi è stato chiesto un pagamento
-- per un evento dichiarato gratuito»), in event_reports.kind.

alter table public.events
  add column if not exists free_declared_at timestamptz,
  add column if not exists free_fee_eur numeric(6, 2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_free_fee_eur_check') then
    alter table public.events add constraint events_free_fee_eur_check check (free_fee_eur >= 0 and free_fee_eur <= 50);
  end if;
end;
$$;

insert into public.system_settings (key, value)
values ('events_free_fee_eur', '"0"')
on conflict (key) do nothing;

alter table public.event_reports
  add column if not exists kind text not null default 'other';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'event_reports_kind_check') then
    alter table public.event_reports add constraint event_reports_kind_check check (kind in ('other', 'free_paid'));
  end if;
end;
$$;

-- Quota fissa per iscritto valida adesso (0 se non impostata o non valida)
create or replace function public.events_free_fee_now()
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v numeric;
begin
  begin
    v := nullif(trim(both '"' from coalesce(public.setting_text('events_free_fee_eur'), '')), '')::numeric;
  exception when others then
    v := 0;
  end;
  return least(greatest(round(coalesce(v, 0), 2), 0), 50);
end;
$$;
revoke all on function public.events_free_fee_now() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- event_save (ultima versione: questo file; prima 20261027100000_tool_switches.sql)
-- + p.free_declared obbligatoria per gli eventi gratuiti, free_declared_at e
--   free_fee_eur. Tutto il resto identico.
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
  v_effective_price := case when public.event_people(p_event) > 0 then v_existing.price else v_price end;
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
    price = case when public.event_people(p_event) > 0 then v_existing.price else greatest(coalesce((p ->> 'price')::numeric, 0), 0) end,
    is_18plus = coalesce((p ->> 'is_18plus')::boolean, false),
    kids_friendly = coalesce((p ->> 'kids_friendly')::boolean, false),
    fidelity_stamp = v_fidelity,
    -- Data della prima dichiarazione; null se diventa a pagamento
    free_declared_at = case when v_effective_price = 0 then coalesce(v_existing.free_declared_at, now()) end,
    -- Quota fissa: bloccata con il prezzo dopo le prime iscrizioni
    free_fee_eur = case when public.event_people(p_event) > 0 then v_existing.free_fee_eur
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
        price = case when public.event_people(v_sibling.id) > 0 then v_sibling.price else greatest(coalesce((p ->> 'price')::numeric, 0), 0) end,
        is_18plus = coalesce((p ->> 'is_18plus')::boolean, false),
        kids_friendly = coalesce((p ->> 'kids_friendly')::boolean, false),
        fidelity_stamp = v_fidelity,
        free_declared_at = case
          when public.event_people(v_sibling.id) > 0 and v_sibling.price > 0 then null
          when public.event_people(v_sibling.id) > 0 then coalesce(v_sibling.free_declared_at, case when v_free_declared then now() end)
          when v_price = 0 then coalesce(v_sibling.free_declared_at, now())
          else null end,
        free_fee_eur = case when public.event_people(v_sibling.id) > 0 then v_sibling.free_fee_eur
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

-- ---------------------------------------------------------------------------
-- Commissione (ultima versione: questo file; prima 20261025100000_events_trips_privacy.sql)
-- prezzo > 0: prezzo × persone × percentuale (come prima);
-- gratuito con quota fissa: persone × quota (percentuale 0, prezzo 0).
-- ---------------------------------------------------------------------------
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
      when exists (select 1 from public.event_participants c where c.event_id = e.id and c.status = 'checked_in')
        then (select count(*)::int from public.event_participants c where c.event_id = e.id and c.status = 'checked_in')
      else public.event_people(e.id) end as people
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

-- ---------------------------------------------------------------------------
-- Stato organizzatore: + free_fee_eur (quota fissa attuale per gli eventi gratuiti)
-- (ultima versione: questo file; prima 20261023100000_events_phase3.sql)
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
    'free_fee_eur', public.events_free_fee_now(),
    'fidelity_card', case when v_card.id is not null
      then jsonb_build_object('business_name', v_card.business_name, 'prize', v_card.prize, 'stamps_needed', v_card.stamps_needed) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- I miei eventi da organizzatore: + free_declared_at e free_fee_eur
-- (ultima versione: questo file; prima 20261015100000_events.sql)
-- ---------------------------------------------------------------------------
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
      'free_declared_at', e.free_declared_at,
      'free_fee_eur', e.free_fee_eur,
      'fee', (select jsonb_build_object('id', f.id, 'amount', f.amount, 'status', f.status, 'participants', f.participants, 'percent', f.percent)
              from public.event_fees f where f.event_id = e.id)
    ) order by (public.event_end(e) < now()), e.starts_at)
    from public.events e where e.organizer_id = v_uid
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Segnalazione: + motivo (p_kind). 'free_paid' = «Mi è stato chiesto un
-- pagamento per un evento dichiarato gratuito» (solo per eventi gratuiti; il
-- testo è facoltativo). Una segnalazione aperta per persona e motivo.
-- (ultima versione: questo file; prima 20261015100000_events.sql)
-- ---------------------------------------------------------------------------
drop function if exists public.event_report(uuid, text);

create or replace function public.event_report(p_event uuid, p_reason text, p_kind text default 'other')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := coalesce(nullif(p_kind, ''), 'other');
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if auth.uid() is null or v_kind not in ('other', 'free_paid') then
    return 'invalid';
  end if;
  if v_kind = 'free_paid' and char_length(v_reason) < 5 then
    v_reason := 'Pagamento chiesto per un evento dichiarato gratuito';
  end if;
  if char_length(v_reason) < 5 then
    return 'invalid';
  end if;
  if not exists (select 1 from public.events where id = p_event) then
    return 'not_found';
  end if;
  if v_kind = 'free_paid' and not exists (select 1 from public.events where id = p_event and price = 0) then
    return 'invalid';
  end if;
  if exists (select 1 from public.event_reports where event_id = p_event and reporter = auth.uid() and status = 'open' and kind = v_kind) then
    return 'ok';
  end if;
  insert into public.event_reports (event_id, reporter, reason, kind) values (p_event, auth.uid(), left(v_reason, 1000), v_kind);
  return 'ok';
end;
$$;
revoke all on function public.event_report(uuid, text, text) from public, anon;
grant execute on function public.event_report(uuid, text, text) to authenticated;
