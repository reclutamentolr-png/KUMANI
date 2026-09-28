-- KUMANI Mosaic (SVAGO, gratis): un'opera collettiva a stagioni. Ogni Kumano
-- piazza qualche tessera al giorno su una tela condivisa; una tessera
-- piazzata non si copre più, così l'opera si riempie fino all'ultima.
--
-- - Tela: una riga per tessera piazzata (chiave stagione + x + y): la chiave
--   stessa impedisce di coprire una tessera, anche con due tocchi insieme.
-- - Tessere al giorno, tessera bonus e giorni di accesso minimi si cambiano da
--   Admin (system_settings); dimensione e date da Admin → Mosaic, per stagione.
-- - Aggiornamenti in tempo reale su un canale privato: viaggiano solo
--   posizione e colore, mai chi ha piazzato la tessera.

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('mosaic', true, 'free', 'KUMANI Mosaic – opera collettiva a tessere. Spento: sola lettura')
on conflict (tool_name) do nothing;

insert into public.system_settings (key, value) values
  ('mosaic_pixels_day', '3'),
  ('mosaic_bonus_pixels', '1'),
  ('mosaic_min_login_days', '7')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Giorni di accesso (un giorno = il KU di accesso giornaliero)
-- ---------------------------------------------------------------------------
create table if not exists public.login_day_counts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  days integer not null default 0
);
alter table public.login_day_counts enable row level security;

-- Stima per chi è già iscritto: non c'è lo storico degli accessi, quindi si
-- prende il minimo tra i giorni dall'iscrizione e i KU guadagnati
insert into public.login_day_counts (user_id, days)
select p.id, least(coalesce(p.ku_earned_total, 0), greatest(1, (current_date - p.created_at::date) + 1))
from public.profiles p
where p.last_daily_login is not null
on conflict (user_id) do nothing;

create or replace function public.award_daily_login_point()
returns table (awarded boolean, new_daily_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_points int;
begin
  if auth.uid() is null then
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + 1,
      ku_earned_total = coalesce(ku_earned_total, 0) + 1,
      last_daily_login = v_today
  where id = auth.uid()
    and (last_daily_login is null or last_daily_login < v_today)
  returning daily_points into v_points;

  if not found then
    select coalesce(daily_points, 0) into v_points from profiles where id = auth.uid();
    return query select false, v_points;
    return;
  end if;
  insert into public.login_day_counts (user_id, days) values (auth.uid(), 1)
  on conflict (user_id) do update set days = login_day_counts.days + 1;
  return query select true, v_points;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table if not exists public.mosaic_seasons (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  theme text check (theme is null or char_length(theme) <= 200),
  width integer not null default 64 check (width between 16 and 256),
  height integer not null default 64 check (height between 16 and 256),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_mosaic_seasons_dates on public.mosaic_seasons(starts_at, ends_at);

create table if not exists public.mosaic_pixels (
  season_id uuid not null references public.mosaic_seasons(id) on delete cascade,
  x smallint not null check (x >= 0),
  y smallint not null check (y >= 0),
  color smallint not null check (color between 0 and 31),
  -- Account cancellato: la tessera resta nell'opera, senza autore
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (season_id, x, y)
);
create index if not exists idx_mosaic_pixels_season_time on public.mosaic_pixels(season_id, created_at);
create index if not exists idx_mosaic_pixels_user on public.mosaic_pixels(user_id, created_at);

-- Tutto passa dalle funzioni: nessuna lettura o scrittura diretta
alter table public.mosaic_seasons enable row level security;
alter table public.mosaic_pixels enable row level security;

-- ---------------------------------------------------------------------------
-- Funzioni
-- ---------------------------------------------------------------------------
create or replace function public.mosaic_setting(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when trim(coalesce(public.setting_text(p_key), '')) ~ '^\d{1,4}$'
              then trim(public.setting_text(p_key))::integer else p_default end;
$$;
revoke all on function public.mosaic_setting(text, integer) from public, anon, authenticated;

-- Stagione in corso (se più stagioni si sovrappongono, vale l'ultima iniziata)
create or replace function public.mosaic_current_season()
returns public.mosaic_seasons
language sql
stable
security definer
set search_path = public
as $$
  select * from public.mosaic_seasons where starts_at <= now() and ends_at > now()
  order by starts_at desc limit 1;
$$;
revoke all on function public.mosaic_current_season() from public, anon, authenticated;

-- Tela come sequenza di byte (0 = vuota, 1..32 = colore + 1), in base64
create or replace function public.mosaic_canvas(p_season uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select encode(decode(string_agg(lpad(to_hex(coalesce(p.color + 1, 0)), 2, '0'), '' order by g.i), 'hex'), 'base64')
  from public.mosaic_seasons s
  cross join lateral generate_series(0, s.width * s.height - 1) g(i)
  left join public.mosaic_pixels p on p.season_id = s.id and p.y * s.width + p.x = g.i
  where s.id = p_season and auth.uid() is not null;
$$;
revoke all on function public.mosaic_canvas(uuid) from public, anon;
grant execute on function public.mosaic_canvas(uuid) to authenticated;

-- Tessere che l'utente può ancora piazzare oggi
create or replace function public.mosaic_allowance(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with d as (select (now() at time zone 'Europe/Rome')::date as today),
  used as (
    select count(*)::int as n from public.mosaic_pixels, d
    where user_id = p_uid and created_at >= d.today::timestamp at time zone 'Europe/Rome'
  ),
  bonus as (
    -- Bonus: oggi hai usato un altro servizio KUMANI (punto KU giornaliero)
    select exists (select 1 from public.daily_tool_points, d where user_id = p_uid and awarded_on = d.today and tool_name <> 'mosaic') as earned
  )
  select jsonb_build_object(
    'base', public.mosaic_setting('mosaic_pixels_day', 3),
    'bonus', case when bonus.earned then public.mosaic_setting('mosaic_bonus_pixels', 1) else 0 end,
    'bonus_available', public.mosaic_setting('mosaic_bonus_pixels', 1),
    'used', used.n,
    'left', greatest(0, public.mosaic_setting('mosaic_pixels_day', 3)
                        + case when bonus.earned then public.mosaic_setting('mosaic_bonus_pixels', 1) else 0 end - used.n)
  )
  from used, bonus;
$$;
revoke all on function public.mosaic_allowance(uuid) from public, anon, authenticated;

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
      'mine', (select count(*) from public.mosaic_pixels where season_id = v_season.id and user_id = v_uid)
    ) end,
    'canvas', case when v_season.id is not null then public.mosaic_canvas(v_season.id) end,
    'next_season', case when v_next.id is not null then jsonb_build_object('title', v_next.title, 'starts_at', v_next.starts_at) end,
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

-- Piazzare una tessera
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
  -- Tutti vedono la tessera comparire (solo posizione e colore)
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

-- Staff: toglie tutte le tessere di una persona in una stagione (vandalismo);
-- le caselle tornano libere e le tele aperte si ricaricano
create or replace function public.mosaic_admin_clear_user(p_season uuid, p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.mosaic_pixels where season_id = p_season and user_id = p_user;
  get diagnostics v_count = row_count;
  begin
    perform realtime.send(jsonb_build_object('at', now()), 'reload', 'mosaic:' || p_season::text, true);
  exception when others then
    null;
  end;
  return v_count;
end;
$$;
revoke all on function public.mosaic_admin_clear_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mosaic_admin_clear_user(uuid, uuid) to service_role;

-- Staff: stagioni con i loro numeri
create or replace function public.mosaic_admin_seasons()
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
    'current', s.id = (public.mosaic_current_season()).id
  ) order by s.starts_at desc), '[]'::jsonb)
  from public.mosaic_seasons s;
$$;
revoke all on function public.mosaic_admin_seasons() from public, anon, authenticated;
grant execute on function public.mosaic_admin_seasons() to service_role;

-- Staff: chi ha piazzato più tessere in una stagione (per la moderazione)
create or replace function public.mosaic_admin_contributors(p_season uuid)
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
    group by p.user_id, pr.first_name, pr.last_name, pr.email
    order by count(*) desc
    limit 200
  ) t;
$$;
revoke all on function public.mosaic_admin_contributors(uuid) from public, anon, authenticated;
grant execute on function public.mosaic_admin_contributors(uuid) to service_role;

-- Canale in tempo reale: qualunque Kumano collegato può ascoltare la tela
drop policy if exists mosaic_channel on realtime.messages;
create policy mosaic_channel on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast' and realtime.topic() like 'mosaic:%');

-- Prima stagione: 64×64, fino a fine ottobre (date e dimensione da Admin)
insert into public.mosaic_seasons (title, theme, width, height, starts_at, ends_at)
select 'Stagione 1', null, 64, 64, now(), timestamp '2026-11-01 00:00' at time zone 'Europe/Rome'
where not exists (select 1 from public.mosaic_seasons);

-- ---------------------------------------------------------------------------
-- Cancellazione account (GDPR): le tessere restano nell'opera senza autore
-- ---------------------------------------------------------------------------
create or replace function public.profiles_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fidelity_members where user_id = new.id;
  delete from public.trip_exits where user_id = new.id;
  update public.veritas_players set nickname = 'Kumano' where user_id = new.id;
  delete from public.svat_qc_reports where user_id = new.id;
  update public.timebank_exchanges set status = 'cancelled', cancelled_by = new.id, updated_at = now()
  where new.id in (giver_id, receiver_id) and status in ('proposed', 'accepted');
  delete from public.timebank_posts where user_id = new.id;
  delete from public.timebank_profiles where user_id = new.id;
  delete from public.timebank_messages where sender_id = new.id;
  delete from public.inventory_products where owner_id = new.id;
  delete from public.inventory_categories where owner_id = new.id;
  update public.mosaic_pixels set user_id = null where user_id = new.id;
  delete from public.login_day_counts where user_id = new.id;
  return new;
end;
$$;

-- Punti KU giornalieri anche per il Mosaic
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
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic'
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
