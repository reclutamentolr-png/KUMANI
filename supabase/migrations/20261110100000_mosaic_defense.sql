-- KUMANI Mosaic, fase 3 "Difesa": segnalazioni di un'area, pulizia di
-- un'area da Admin, zone protette (solo lo Staff ci piazza tessere), sagoma
-- guida della stagione e disegno dello Staff.

-- Sagoma guida: un byte per casella come la tela (0 = niente, 1..32 = colore + 1)
alter table public.mosaic_seasons add column if not exists template bytea;

-- Zone protette: rettangoli dove piazza solo lo Staff
create table if not exists public.mosaic_zones (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.mosaic_seasons(id) on delete cascade,
  x smallint not null check (x >= 0),
  y smallint not null check (y >= 0),
  w smallint not null check (w between 1 and 256),
  h smallint not null check (h between 1 and 256),
  label text check (label is null or char_length(label) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists idx_mosaic_zones_season on public.mosaic_zones(season_id);
alter table public.mosaic_zones enable row level security;

-- Segnalazioni di un'area (quadrato intorno alla casella toccata)
create table if not exists public.mosaic_reports (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.mosaic_seasons(id) on delete cascade,
  reporter uuid references auth.users(id) on delete set null,
  x smallint not null, y smallint not null, w smallint not null, h smallint not null,
  reason text not null check (reason in ('offensive', 'advertising', 'other')),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_mosaic_reports_open on public.mosaic_reports(status, created_at);
create index if not exists idx_mosaic_reports_reporter on public.mosaic_reports(reporter, created_at);
alter table public.mosaic_reports enable row level security;

create or replace function public.mosaic_in_zone(p_season uuid, p_x integer, p_y integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.mosaic_zones z where z.season_id = p_season
                 and p_x >= z.x and p_x < z.x + z.w and p_y >= z.y and p_y < z.y + z.h);
$$;
revoke all on function public.mosaic_in_zone(uuid, integer, integer) from public, anon, authenticated;

-- Piazzare una tessera: ora anche fuori dalle zone protette
create or replace function public.mosaic_place(p_season uuid, p_x integer, p_y integer, p_color integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_season public.mosaic_seasons;
  v_allowance jsonb;
  v_blocked boolean;
begin
  perform public.tool_require_online('mosaic');
  if v_uid is null then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  select coalesce(is_blocked, false) or deleted_at is not null into v_blocked from public.profiles where id = v_uid;
  if coalesce(v_blocked, true) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if coalesce((select days from public.login_day_counts where user_id = v_uid), 0) < public.mosaic_setting('mosaic_min_login_days', 7) then
    return jsonb_build_object('error', 'too_new');
  end if;
  v_season := public.mosaic_current_season();
  if v_season.id is null or v_season.id is distinct from p_season then
    return jsonb_build_object('error', 'season_closed');
  end if;
  if p_x is null or p_y is null or p_x < 0 or p_y < 0 or p_x >= v_season.width or p_y >= v_season.height
     or p_color is null or p_color < 0 or p_color > 31 then
    return jsonb_build_object('error', 'invalid');
  end if;
  if public.mosaic_in_zone(p_season, p_x, p_y) then
    return jsonb_build_object('error', 'protected');
  end if;
  -- Una richiesta alla volta per utente: il conteggio di oggi resta esatto
  perform pg_advisory_xact_lock(hashtext('mosaic:' || v_uid::text));
  v_allowance := public.mosaic_allowance(v_uid);
  if (v_allowance ->> 'left')::int <= 0 then
    return jsonb_build_object('error', 'no_pixels');
  end if;
  insert into public.mosaic_pixels (season_id, x, y, color, user_id) values (p_season, p_x, p_y, p_color, v_uid)
  on conflict (season_id, x, y) do nothing;
  if not found then
    return jsonb_build_object('error', 'taken');
  end if;
  begin
    perform realtime.send(jsonb_build_object('x', p_x, 'y', p_y, 'c', p_color), 'pixel', 'mosaic:' || p_season::text, true);
  exception when others then
    null;
  end;
  return jsonb_build_object('ok', true, 'left', (v_allowance ->> 'left')::int - 1);
end;
$$;
revoke all on function public.mosaic_place(uuid, integer, integer, integer) from public, anon;
grant execute on function public.mosaic_place(uuid, integer, integer, integer) to authenticated;

-- Segnalare un'area: niente doppioni sulla stessa zona, al massimo 5 al giorno
create or replace function public.mosaic_report(p_season uuid, p_x integer, p_y integer, p_reason text, p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_season public.mosaic_seasons;
  v_size int;
  v_x int;
  v_y int;
begin
  if v_uid is null or coalesce((select coalesce(is_blocked, false) or deleted_at is not null from public.profiles where id = v_uid), true) then
    return 'not_allowed';
  end if;
  select * into v_season from public.mosaic_seasons where id = p_season and starts_at <= now();
  if v_season.id is null or p_x is null or p_y is null or p_x < 0 or p_y < 0 or p_x >= v_season.width or p_y >= v_season.height
     or coalesce(p_reason, '') not in ('offensive', 'advertising', 'other') then
    return 'invalid';
  end if;
  -- Quadrato di 9 caselle di lato intorno alla casella toccata (dentro la tela)
  v_size := least(9, v_season.width, v_season.height);
  v_x := least(greatest(p_x - v_size / 2, 0), v_season.width - v_size);
  v_y := least(greatest(p_y - v_size / 2, 0), v_season.height - v_size);
  perform pg_advisory_xact_lock(hashtext('mosaic_report:' || v_uid::text));
  if exists (select 1 from public.mosaic_reports where reporter = v_uid and season_id = p_season and status = 'open'
             and p_x >= x and p_x < x + w and p_y >= y and p_y < y + h) then
    return 'report_already';
  end if;
  if (select count(*) from public.mosaic_reports where reporter = v_uid
      and created_at >= (now() at time zone 'Europe/Rome')::date at time zone 'Europe/Rome') >= 5 then
    return 'report_limit';
  end if;
  insert into public.mosaic_reports (season_id, reporter, x, y, w, h, reason, note)
  values (p_season, v_uid, v_x, v_y, v_size, v_size, p_reason, nullif(left(trim(coalesce(p_note, '')), 300), ''));
  return 'ok';
end;
$$;
revoke all on function public.mosaic_report(uuid, integer, integer, text, text) from public, anon;
grant execute on function public.mosaic_report(uuid, integer, integer, text, text) to authenticated;

-- Stato: anche zone protette e sagoma guida della stagione in corso
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
      'badges', public.mosaic_badges(v_season.id, v_uid),
      'zones', coalesce((select jsonb_agg(jsonb_build_object('x', z.x, 'y', z.y, 'w', z.w, 'h', z.h, 'label', z.label))
                         from public.mosaic_zones z where z.season_id = v_season.id), '[]'::jsonb),
      'template', case when v_season.template is not null then encode(v_season.template, 'base64') end
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

-- ---------------------------------------------------------------------------
-- Staff (solo dal server)
-- ---------------------------------------------------------------------------

-- Avvisa le tele aperte di ricaricarsi
create or replace function public.mosaic_notify_reload(p_season uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(jsonb_build_object('at', now()), 'reload', 'mosaic:' || p_season::text, true);
exception when others then
  null;
end;
$$;
revoke all on function public.mosaic_notify_reload(uuid) from public, anon, authenticated;

-- Tela per l'editor dello Staff (senza sessione utente)
create or replace function public.mosaic_admin_canvas(p_season uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'canvas', encode(decode(string_agg(lpad(to_hex(coalesce(p.color + 1, 0)), 2, '0'), '' order by g.i), 'hex'), 'base64'),
    'template', (select encode(template, 'base64') from public.mosaic_seasons where id = p_season),
    'zones', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'x', z.x, 'y', z.y, 'w', z.w, 'h', z.h, 'label', z.label) order by z.created_at)
                       from public.mosaic_zones z where z.season_id = p_season), '[]'::jsonb)
  )
  from public.mosaic_seasons s
  cross join lateral generate_series(0, s.width * s.height - 1) g(i)
  left join public.mosaic_pixels p on p.season_id = s.id and p.y * s.width + p.x = g.i
  where s.id = p_season;
$$;
revoke all on function public.mosaic_admin_canvas(uuid) from public, anon, authenticated;
grant execute on function public.mosaic_admin_canvas(uuid) to service_role;

-- Toglie tutte le tessere dentro un rettangolo
create or replace function public.mosaic_admin_clear_area(p_season uuid, p_x integer, p_y integer, p_w integer, p_h integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.mosaic_pixels where season_id = p_season
    and x >= p_x and x < p_x + p_w and y >= p_y and y < p_y + p_h;
  get diagnostics v_count = row_count;
  perform public.mosaic_notify_reload(p_season);
  return v_count;
end;
$$;
revoke all on function public.mosaic_admin_clear_area(uuid, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.mosaic_admin_clear_area(uuid, integer, integer, integer, integer) to service_role;

-- Chi ha piazzato tessere dentro un rettangolo
create or replace function public.mosaic_admin_area_people(p_season uuid, p_x integer, p_y integer, p_w integer, p_h integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by (x ->> 'pixels')::int desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'user_id', p.user_id, 'pixels', count(*), 'last_at', max(p.created_at),
      'name', trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), 'email', pr.email
    ) as x
    from public.mosaic_pixels p
    left join public.profiles pr on pr.id = p.user_id
    where p.season_id = p_season and p.user_id is not null
      and p.x >= p_x and p.x < p_x + p_w and p.y >= p_y and p.y < p_y + p_h
    group by p.user_id, pr.first_name, pr.last_name, pr.email
  ) t;
$$;
revoke all on function public.mosaic_admin_area_people(uuid, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.mosaic_admin_area_people(uuid, integer, integer, integer, integer) to service_role;

-- Disegno dello Staff: tessere senza autore, anche sopra quelle esistenti;
-- colore -1 = cancella la casella
create or replace function public.mosaic_admin_paint(p_season uuid, p_cells jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.mosaic_seasons;
  v_count int := 0;
  v_cell jsonb;
  v_x int;
  v_y int;
  v_c int;
begin
  select * into v_season from public.mosaic_seasons where id = p_season;
  if v_season.id is null or jsonb_typeof(p_cells) <> 'array' or jsonb_array_length(p_cells) > 70000 then
    return -1;
  end if;
  for v_cell in select * from jsonb_array_elements(p_cells) loop
    v_x := (v_cell ->> 'x')::int;
    v_y := (v_cell ->> 'y')::int;
    v_c := (v_cell ->> 'c')::int;
    continue when v_x is null or v_y is null or v_c is null or v_x < 0 or v_y < 0
                  or v_x >= v_season.width or v_y >= v_season.height or v_c < -1 or v_c > 31;
    if v_c = -1 then
      delete from public.mosaic_pixels where season_id = p_season and x = v_x and y = v_y;
    else
      insert into public.mosaic_pixels (season_id, x, y, color, user_id) values (p_season, v_x, v_y, v_c, null)
      on conflict (season_id, x, y) do update set color = excluded.color, user_id = null, created_at = now();
    end if;
    v_count := v_count + 1;
  end loop;
  perform public.mosaic_notify_reload(p_season);
  return v_count;
end;
$$;
revoke all on function public.mosaic_admin_paint(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mosaic_admin_paint(uuid, jsonb) to service_role;

-- Sagoma guida (base64 di larghezza × altezza byte, null = nessuna)
create or replace function public.mosaic_admin_set_template(p_season uuid, p_template text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.mosaic_seasons;
  v_bytes bytea;
begin
  select * into v_season from public.mosaic_seasons where id = p_season;
  if v_season.id is null then
    return 'not_found';
  end if;
  if p_template is null then
    update public.mosaic_seasons set template = null where id = p_season;
    return 'ok';
  end if;
  v_bytes := decode(p_template, 'base64');
  if length(v_bytes) <> v_season.width * v_season.height then
    return 'size';
  end if;
  update public.mosaic_seasons set template = v_bytes where id = p_season;
  return 'ok';
end;
$$;
revoke all on function public.mosaic_admin_set_template(uuid, text) from public, anon, authenticated;
grant execute on function public.mosaic_admin_set_template(uuid, text) to service_role;

-- Pallino oro in Admin: anche le segnalazioni del Mosaic
create or replace function public.admin_section_badges()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_default timestamptz := now() - interval '7 days';
  seen jsonb;
begin
  if v_uid is null or not public.admin_is_staff(v_uid) then
    return '{}'::jsonb;
  end if;
  select coalesce(jsonb_object_agg(section, seen_at), '{}'::jsonb) into seen from public.admin_section_seen where admin_id = v_uid;
  return jsonb_strip_nulls(jsonb_build_object(
    'users', nullif((select count(*) from public.profiles where created_at > coalesce((seen ->> 'users')::timestamptz, v_default)), 0),
    'profileRequests', nullif((select count(*) from public.profile_change_requests where status = 'pending' and created_at > coalesce((seen ->> 'profileRequests')::timestamptz, v_default)), 0),
    'accountDeletions', nullif((select count(*) from public.account_deletion_requests where status = 'pending' and requested_at > coalesce((seen ->> 'accountDeletions')::timestamptz, v_default)), 0),
    'listingReports', nullif((select count(*) from public.listing_reports where created_at > coalesce((seen ->> 'listingReports')::timestamptz, v_default)), 0),
    'spotlight', nullif((select count(*) from public.spotlight_profiles where moderation_status = 'pending' and updated_at > coalesce((seen ->> 'spotlight')::timestamptz, v_default)), 0),
    'affinity', nullif((select count(*) from public.affinity_reports where status = 'open' and created_at > coalesce((seen ->> 'affinity')::timestamptz, v_default)), 0),
    'convivio', nullif((select count(*) from public.convivio_reports where status = 'open' and created_at > coalesce((seen ->> 'convivio')::timestamptz, v_default))
                     + (select count(*) from public.convivio_groups where created_at > coalesce((seen ->> 'convivio')::timestamptz, v_default)), 0),
    'events', nullif((select count(*) from public.events where status = 'pending' and updated_at > coalesce((seen ->> 'events')::timestamptz, v_default))
                   + (select count(*) from public.event_reports where status = 'open' and created_at > coalesce((seen ->> 'events')::timestamptz, v_default))
                   + (select count(*) from public.events where status = 'published' and created_at > coalesce((seen ->> 'events')::timestamptz, v_default)), 0),
    'identity', nullif((select count(*) from public.identity_verifications where status = 'pending' and created_at > coalesce((seen ->> 'identity')::timestamptz, v_default)), 0),
    'convivioFees', nullif((select count(*) from public.convivio_fees where created_at > coalesce((seen ->> 'convivioFees')::timestamptz, v_default)), 0),
    'rewards', nullif((select count(*) from public.reward_redemptions where fulfilled_at is null and redeemed_at > coalesce((seen ->> 'rewards')::timestamptz, v_default)), 0),
    'contactMessages', nullif((select count(*) from public.contact_messages where status = 'new' and created_at > coalesce((seen ->> 'contactMessages')::timestamptz, v_default)), 0),
    'timebank', nullif((select count(*) from public.timebank_exchanges where status = 'disputed' and updated_at > coalesce((seen ->> 'timebank')::timestamptz, v_default))
                     + (select count(*) from public.timebank_reports where status = 'open' and created_at > coalesce((seen ->> 'timebank')::timestamptz, v_default)), 0),
    'mosaic', nullif((select count(*) from public.mosaic_reports where status = 'open' and created_at > coalesce((seen ->> 'mosaic')::timestamptz, v_default)), 0)
  ));
end;
$$;
