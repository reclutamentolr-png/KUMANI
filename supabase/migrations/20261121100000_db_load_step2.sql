-- Passo 2 dell'alleggerimento del database (servizi gratuiti).
-- Tutto idempotente: si può eseguire più volte senza problemi.

-- 1. Messaggi della Bacheca: indici per lista conversazioni, non letti,
--    chat per annuncio e controllo anti-spam (20 messaggi al minuto).
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_receiver_created_idx on public.messages (receiver_id, created_at desc);
create index if not exists messages_receiver_unread_idx on public.messages (receiver_id) where is_read = false;
create index if not exists messages_listing_created_idx on public.messages (listing_id, created_at);

-- Messaggi in tempo reale nella chat (se la tabella non era già attivata)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- 2. Annunci: indici per la lista (attivi, dal più recente), i miei annunci
--    e la ricerca per parole in titolo e descrizione (trigrammi).
create index if not exists listings_active_created_idx on public.listings (created_at desc) where is_active;
create index if not exists listings_user_created_idx on public.listings (user_id, created_at desc);
create index if not exists listings_featured_idx on public.listings (featured_until desc) where is_active and featured_until is not null;
create extension if not exists pg_trgm with schema extensions;
do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute format('create index if not exists listings_title_trgm_idx on public.listings using gin (title %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists listings_description_trgm_idx on public.listings using gin (description %I.gin_trgm_ops)', v_schema);
end $$;

-- 3. Banca del Tempo: al massimo 100 messaggi al giorno per persona (come
--    Kordata) e lista dei messaggi limitata agli ultimi 200.
create index if not exists idx_tb_messages_sender on public.timebank_messages (sender_id, created_at);

create or replace function public.timebank_send(p_exchange uuid, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('timebank');
  if public.timebank_blocked(auth.uid()) then
    return 'not_allowed';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then
    return 'invalid';
  end if;
  if not exists (select 1 from public.timebank_exchanges where id = p_exchange and auth.uid() in (giver_id, receiver_id)
                 and status in ('proposed', 'accepted', 'disputed')) then
    return 'not_allowed';
  end if;
  if (select count(*) from public.timebank_messages where sender_id = auth.uid() and created_at > now() - interval '1 day') >= 100 then
    return 'tooManyMessages';
  end if;
  insert into public.timebank_messages (exchange_id, sender_id, body) values (p_exchange, auth.uid(), left(trim(p_body), 1000));
  return 'ok';
end;
$$;

create or replace function public.timebank_messages_list(p_exchange uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.sender_id = auth.uid(), 'name', public.timebank_name(m.sender_id),
    'body', m.body, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
  from (
    select m.*
    from public.timebank_messages m
    join public.timebank_exchanges e on e.id = m.exchange_id
    where m.exchange_id = p_exchange and auth.uid() in (e.giver_id, e.receiver_id)
    order by m.created_at desc
    limit 200
  ) m;
$$;

-- 4. Veritas: al massimo 20 stanze create al giorno per persona.
create index if not exists veritas_rooms_host_created_idx on public.veritas_rooms (host_user_id, created_at);

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
  if auth.uid() is not null
     and (select count(*) from public.veritas_rooms where host_user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_rooms';
  end if;
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

-- 5. Kordata: la lista mostra al massimo i 100 gruppi più recenti; il filtro
--    "i miei" usa direttamente capocordata, fornitore e adesioni (già
--    indicizzati: le adesioni hanno la chiave primaria gruppo + utente).

create or replace function public.convivio_list(p_filter text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.convivio_card(x.id, auth.uid()) order by x.expires_at), '[]'::jsonb)
  from (
    select g.id, g.expires_at
    from public.convivio_groups g
    join public.profiles p on p.id = g.leader_id
    where auth.uid() is not null
      and not coalesce(p.is_blocked, false)
      and case
        when p_filter = 'mine' then g.leader_id = auth.uid() or g.supplier_id = auth.uid()
          or exists (select 1 from public.convivio_pledges cp where cp.group_id = g.id and cp.user_id = auth.uid())
        when p_filter = 'supplier' then g.supplier_id = auth.uid()
        else g.status = 'open' and g.expires_at > now() and g.supplier_status in ('none', 'confirmed')
      end
    order by g.created_at desc
    limit 100
  ) x;
$$;

-- 6. Affinity: nuovi abbinamenti cercati al massimo una volta all'ora.
alter table public.affinity_profiles add column if not exists last_match_at timestamptz;

CREATE OR REPLACE FUNCTION public.affinity_friends_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_me public.affinity_profiles%rowtype;
  v_mp public.profiles%rowtype;
  v_week date := date_trunc('week', now())::date;
  v_limit int := greatest(coalesce(nullif(public.setting_text('affinity_intros_per_week'), '')::int, 3), 0);
  v_have int;
  v_intros jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'blocked');
  end if;
  v_status := coalesce(public.affinity_friends_status(v_uid), 'blocked');
  select * into v_me from public.affinity_profiles where user_id = v_uid;
  select * into v_mp from public.profiles where id = v_uid;

  if v_status = 'ok' and v_me.opt_friends then
    select count(*) into v_have from public.affinity_intros
    where week = v_week and v_uid in (user_a, user_b);

    -- Ricerca di nuovi abbinamenti al massimo una volta all'ora per persona
    -- (prima a ogni lettura, cioè ogni 60 secondi con la pagina aperta, su
    -- tutti i profili). La prima volta parte subito.
    if v_have < v_limit and (v_me.last_match_at is null or v_me.last_match_at < now() - interval '1 hour') then
      update public.affinity_profiles set last_match_at = now() where user_id = v_uid;
      insert into public.affinity_intros (week, user_a, user_b, score)
      select v_week, least(v_uid, c.user_id), greatest(v_uid, c.user_id), c.score
      from (
        select a2.user_id,
          round(100 * (1 - sqrt(
            power((v_me.map ->> 'valori')::numeric - (a2.map ->> 'valori')::numeric, 2) +
            power((v_me.map ->> 'ritmo')::numeric - (a2.map ->> 'ritmo')::numeric, 2) +
            power((v_me.map ->> 'curiosita')::numeric - (a2.map ->> 'curiosita')::numeric, 2) +
            power((v_me.map ->> 'calore')::numeric - (a2.map ->> 'calore')::numeric, 2) +
            power((v_me.map ->> 'avventura')::numeric - (a2.map ->> 'avventura')::numeric, 2)
          ) / sqrt(5)))::int as score,
          -- Prima la lingua in comune, poi paese e città (funziona anche con pochi iscritti)
          (case when a2.languages && v_me.languages then 15 else 0 end)
          + (case when p2.country_code = v_mp.country_code then 10 else 0 end)
          + (case when v_mp.city is not null and lower(trim(p2.city)) = lower(trim(v_mp.city)) then 5 else 0 end) as bonus
        from public.affinity_profiles a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.opt_friends
          and a2.user_id <> v_uid
          and public.affinity_friends_status(a2.user_id) = 'ok'
          and not public.affinity_is_blocked(v_uid, a2.user_id)
          and not exists (
            select 1 from public.affinity_intros i
            where i.user_a = least(v_uid, a2.user_id) and i.user_b = greatest(v_uid, a2.user_id)
          )
          and (select count(*) from public.affinity_intros i2 where i2.week = v_week and a2.user_id in (i2.user_a, i2.user_b)) < v_limit
      ) c
      order by c.score + c.bonus desc, md5(c.user_id::text || v_week::text)
      limit (v_limit - v_have)
      on conflict (user_a, user_b) do nothing;
    end if;
  end if;

  select coalesce(jsonb_agg(r.item order by (r.item ->> 'week') desc, (r.item ->> 'score')::int desc), '[]'::jsonb) into v_intros
  from (
    select jsonb_build_object(
      'id', i.id,
      'week', i.week,
      'other_id', o.id,
      'first_name', o.first_name,
      'city', case when i.a_response = 'yes' and i.b_response = 'yes' then o.city end,
      'verified', o.created_at <= now() - interval '30 days',
      'archetype', oa.archetype,
      'map', oa.map,
      'bio', oa.bio,
      'score', i.score,
      'status', case
        when my.resp = 'no' then 'declined'
        when my.resp is null then 'pending'
        when their.resp = 'yes' then 'match'
        when their.resp = 'no' then 'closed'
        else 'waiting'
      end,
      'unread', (
        select count(*) from public.affinity_messages m
        where m.intro_id = i.id and m.sender_id <> v_uid and m.read_at is null
      )
    ) as item
    from public.affinity_intros i
    cross join lateral (select case when i.user_a = v_uid then i.a_response else i.b_response end as resp) my
    cross join lateral (select case when i.user_a = v_uid then i.b_response else i.a_response end as resp) their
    join public.profiles o on o.id = case when i.user_a = v_uid then i.user_b else i.user_a end
    left join public.affinity_profiles oa on oa.user_id = o.id
    where v_uid in (i.user_a, i.user_b)
      and not public.affinity_is_blocked(v_uid, o.id)
      and (i.week = v_week or (i.a_response = 'yes' and i.b_response = 'yes'))
  ) r;

  return jsonb_build_object(
    'status', v_status,
    'has_map', v_me.user_id is not null,
    'opted_in', coalesce(v_me.opt_friends, false),
    'bio', v_me.bio,
    'languages', to_jsonb(coalesce(v_me.languages, '{}')),
    'per_week', v_limit,
    'intros', v_intros
  );
end;
$function$;
