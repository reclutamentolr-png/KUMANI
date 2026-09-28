-- KUMANI Mosaic, fase 2 "Memoria": archivio delle stagioni concluse,
-- timelapse, riconoscimenti e data di una tessera. Nessuna tabella nuova:
-- con le tessere non sovrascrivibili, l'elenco delle tessere con la loro ora
-- è già la storia completa dell'opera.

-- Riconoscimenti di una persona in una stagione
--   cofounder  una tessera nelle prime 24 ore della stagione
--   last_tile  la tessera che ha completato la tela
--   mosaicist  almeno 50 tessere nella stagione
create or replace function public.mosaic_badges(p_season uuid, p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'cofounder', exists (
      select 1 from public.mosaic_pixels p
      where p.season_id = s.id and p.user_id = p_uid and p.created_at < s.starts_at + interval '24 hours'
    ),
    'last_tile', (select count(*) from public.mosaic_pixels p where p.season_id = s.id) >= s.width * s.height
      and coalesce((select p.user_id = p_uid from public.mosaic_pixels p where p.season_id = s.id
                    order by p.created_at desc, p.y desc, p.x desc limit 1), false),
    'mosaicist', (select count(*) from public.mosaic_pixels p where p.season_id = s.id and p.user_id = p_uid) >= 50
  )
  from public.mosaic_seasons s
  where s.id = p_season and p_uid is not null;
$$;
revoke all on function public.mosaic_badges(uuid, uuid) from public, anon, authenticated;

-- Timelapse: le tessere nell'ordine in cui sono state piazzate, 3 byte
-- ciascuna (x, y, colore; +128 sul colore se è una tessera di chi guarda)
create or replace function public.mosaic_timeline(p_season uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(encode(decode(string_agg(
    lpad(to_hex(p.x::integer), 2, '0') || lpad(to_hex(p.y::integer), 2, '0')
      || lpad(to_hex(p.color::integer + case when p.user_id = auth.uid() then 128 else 0 end), 2, '0'),
    '' order by p.created_at, p.y, p.x), 'hex'), 'base64'), '')
  from public.mosaic_pixels p
  join public.mosaic_seasons s on s.id = p.season_id
  where p.season_id = p_season and s.starts_at <= now() and auth.uid() is not null;
$$;
revoke all on function public.mosaic_timeline(uuid) from public, anon;
grant execute on function public.mosaic_timeline(uuid) to authenticated;

-- Quando è stata piazzata una tessera (mai da chi: solo se è la tua)
create or replace function public.mosaic_cell(p_season uuid, p_x integer, p_y integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('placed_at', p.created_at, 'mine', p.user_id = auth.uid())
  from public.mosaic_pixels p
  where p.season_id = p_season and p.x = p_x and p.y = p_y and auth.uid() is not null;
$$;
revoke all on function public.mosaic_cell(uuid, integer, integer) from public, anon;
grant execute on function public.mosaic_cell(uuid, integer, integer) to authenticated;

-- Archivio: le ultime 24 stagioni concluse, con l'opera e i propri numeri
create or replace function public.mosaic_archive()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'title', s.title, 'theme', s.theme, 'width', s.width, 'height', s.height,
    'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'filled', (select count(*) from public.mosaic_pixels p where p.season_id = s.id),
    'contributors', (select count(distinct p.user_id) from public.mosaic_pixels p where p.season_id = s.id),
    'mine', (select count(*) from public.mosaic_pixels p where p.season_id = s.id and p.user_id = auth.uid()),
    'canvas', public.mosaic_canvas(s.id),
    'badges', public.mosaic_badges(s.id, auth.uid())
  ) order by s.ends_at desc), '[]'::jsonb)
  from (select * from public.mosaic_seasons where ends_at <= now() order by ends_at desc limit 24) s
  where auth.uid() is not null;
$$;
revoke all on function public.mosaic_archive() from public, anon;
grant execute on function public.mosaic_archive() to authenticated;

-- Stato: anche i riconoscimenti della stagione in corso e se c'è un archivio
create or replace function public.mosaic_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_season public.mosaic_seasons;
  v_next public.mosaic_seasons;
  v_days int;
  v_min int := public.mosaic_setting('mosaic_min_login_days', 7);
  v_blocked boolean;
begin
  if v_uid is null then
    return null;
  end if;
  v_season := public.mosaic_current_season();
  select * into v_next from public.mosaic_seasons where starts_at > now() order by starts_at limit 1;
  select coalesce(days, 0) into v_days from public.login_day_counts where user_id = v_uid;
  select coalesce(is_blocked, false) or deleted_at is not null into v_blocked from public.profiles where id = v_uid;
  return jsonb_build_object(
    'online', public.tool_online('mosaic'),
    'season', case when v_season.id is not null then jsonb_build_object(
      'id', v_season.id, 'title', v_season.title, 'theme', v_season.theme, 'width', v_season.width, 'height', v_season.height,
      'starts_at', v_season.starts_at, 'ends_at', v_season.ends_at,
      'filled', (select count(*) from public.mosaic_pixels where season_id = v_season.id),
      'contributors', (select count(distinct user_id) from public.mosaic_pixels where season_id = v_season.id),
      'mine', (select count(*) from public.mosaic_pixels where season_id = v_season.id and user_id = v_uid),
      'badges', public.mosaic_badges(v_season.id, v_uid)
    ) end,
    'canvas', case when v_season.id is not null then public.mosaic_canvas(v_season.id) end,
    'next_season', case when v_next.id is not null then jsonb_build_object('title', v_next.title, 'starts_at', v_next.starts_at) end,
    'has_archive', exists (select 1 from public.mosaic_seasons where ends_at <= now()),
    'login_days', coalesce(v_days, 0),
    'min_login_days', v_min,
    'blocked', coalesce(v_blocked, true),
    'eligible', not coalesce(v_blocked, true) and coalesce(v_days, 0) >= v_min,
    'allowance', public.mosaic_allowance(v_uid)
  );
end;
$$;
revoke all on function public.mosaic_status() from public, anon;
grant execute on function public.mosaic_status() to authenticated;
