-- Correzioni dopo il controllo di Mosaic e Fabula.
--
-- Mosaic: le tessere di oggi si contano a parte (se lo Staff toglie le
--   tessere di un vandalo, non gli tornano da piazzare); tela e date delle
--   tessere di una stagione futura non si leggono; il disegno dello Staff non
--   cambia l'ordine della storia dell'opera.
-- Fabula: interruttore Admin su tutte le azioni; niente "cancella e ripubblica"
--   per le storie nascoste; lo Staff può rendere privata una storia in modo
--   definitivo; la soglia delle segnalazioni regge anche con segnalazioni
--   contemporanee; i dadi dei giorni futuri non si leggono.

-- ---------------------------------------------------------------------------
-- Mosaic
-- ---------------------------------------------------------------------------
create table if not exists public.mosaic_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  used integer not null default 0,
  primary key (user_id, day)
);
alter table public.mosaic_daily_usage enable row level security;

-- Tessere già piazzate oggi (prima di questa correzione si contavano sulla tela)
insert into public.mosaic_daily_usage (user_id, day, used)
select user_id, (now() at time zone 'Europe/Rome')::date, count(*)
from public.mosaic_pixels
where user_id is not null and created_at >= (now() at time zone 'Europe/Rome')::date::timestamp at time zone 'Europe/Rome'
group by user_id
on conflict (user_id, day) do update set used = greatest(mosaic_daily_usage.used, excluded.used);

create or replace function public.mosaic_allowance(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with d as (select (now() at time zone 'Europe/Rome')::date as today),
  used as (
    select coalesce((select u.used from public.mosaic_daily_usage u, d where u.user_id = p_uid and u.day = d.today), 0) as n
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
  insert into public.mosaic_daily_usage (user_id, day, used) values (v_uid, (now() at time zone 'Europe/Rome')::date, 1)
  on conflict (user_id, day) do update set used = mosaic_daily_usage.used + 1;
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

-- Tela e date di una tessera: solo per stagioni già iniziate
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
  where s.id = p_season and s.starts_at <= now() and auth.uid() is not null;
$$;
revoke all on function public.mosaic_canvas(uuid) from public, anon;
grant execute on function public.mosaic_canvas(uuid) to authenticated;

create or replace function public.mosaic_cell(p_season uuid, p_x integer, p_y integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('placed_at', p.created_at, 'mine', p.user_id = auth.uid())
  from public.mosaic_pixels p
  join public.mosaic_seasons s on s.id = p.season_id
  where p.season_id = p_season and p.x = p_x and p.y = p_y and s.starts_at <= now() and auth.uid() is not null;
$$;
revoke all on function public.mosaic_cell(uuid, integer, integer) from public, anon;
grant execute on function public.mosaic_cell(uuid, integer, integer) to authenticated;

-- Disegno dello Staff: sopra una tessera esistente cambia il colore ma non
-- l'ora (la storia dell'opera e il riconoscimento "Ultima tessera" restano)
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
      on conflict (season_id, x, y) do update set color = excluded.color, user_id = null;
    end if;
    v_count := v_count + 1;
  end loop;
  perform public.mosaic_notify_reload(p_season);
  return v_count;
end;
$$;
revoke all on function public.mosaic_admin_paint(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mosaic_admin_paint(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Fabula
-- ---------------------------------------------------------------------------
-- Storia resa privata dallo Staff: l'autore non può ripubblicarla
alter table public.fabula_stories add column if not exists staff_locked boolean not null default false;

-- I dadi si leggono solo attraverso le funzioni (niente dadi dei giorni futuri)
revoke all on function public.fabula_roll(date) from public, anon, authenticated;
revoke all on function public.fabula_today() from public, anon, authenticated;

create or replace function public.fabula_set_published(p_story uuid, p_publish boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_story public.fabula_stories;
  v_status text;
begin
  perform public.tool_require_online('fabula');
  select * into v_story from public.fabula_stories where id = p_story and user_id = v_uid for update;
  if v_story.id is null or v_story.roll_date is null or v_story.status in ('hidden', 'removed') or v_story.staff_locked
     or public.fabula_blocked(v_uid) then
    return 'not_allowed';
  end if;
  v_status := case when p_publish then public.fabula_publish_status(v_uid, v_story.title, v_story.body) else 'private' end;
  if v_status is distinct from v_story.status then
    update public.fabula_stories set status = v_status, updated_at = now() where id = p_story;
  end if;
  return v_status;
end;
$$;
revoke all on function public.fabula_set_published(uuid, boolean) from public, anon;
grant execute on function public.fabula_set_published(uuid, boolean) to authenticated;

-- Eliminare: una storia nascosta dalle segnalazioni sparisce per l'autore ma
-- resta registrata (così non si può cancellare e ripubblicare lo stesso giorno)
create or replace function public.fabula_delete(p_story uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story public.fabula_stories;
begin
  perform public.tool_require_online('fabula');
  select * into v_story from public.fabula_stories where id = p_story and user_id = auth.uid() for update;
  if v_story.id is null then
    return 'not_allowed';
  end if;
  if v_story.status in ('hidden', 'removed') or v_story.staff_locked then
    update public.fabula_stories set status = 'removed', updated_at = now() where id = p_story;
  else
    delete from public.fabula_stories where id = p_story;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.fabula_delete(uuid) from public, anon;
grant execute on function public.fabula_delete(uuid) to authenticated;

create or replace function public.fabula_applaud(p_story uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform public.tool_require_online('fabula');
  if v_uid is null or public.fabula_blocked(v_uid) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if not exists (select 1 from public.fabula_stories s where s.id = p_story and s.status = 'published' and s.user_id <> v_uid
                 and not public.fabula_blocked(s.user_id)) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  delete from public.fabula_applause where story_id = p_story and user_id = v_uid;
  if not found then
    insert into public.fabula_applause (story_id, user_id) values (p_story, v_uid) on conflict do nothing;
  end if;
  return jsonb_build_object(
    'applauded', exists (select 1 from public.fabula_applause where story_id = p_story and user_id = v_uid),
    'count', (select count(*) from public.fabula_applause where story_id = p_story)
  );
end;
$$;
revoke all on function public.fabula_applaud(uuid) from public, anon;
grant execute on function public.fabula_applaud(uuid) to authenticated;

create or replace function public.fabula_report(p_story uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_story public.fabula_stories;
begin
  perform public.tool_require_online('fabula');
  if v_uid is null or public.fabula_blocked(v_uid) then
    return 'not_allowed';
  end if;
  if coalesce(p_reason, '') not in ('offensive', 'spam', 'other') then
    return 'invalid';
  end if;
  -- La storia si blocca: segnalazioni contemporanee vengono contate tutte
  select * into v_story from public.fabula_stories where id = p_story for update;
  if v_story.id is null or v_story.status <> 'published' then
    return 'not_found';
  end if;
  if v_story.user_id = v_uid then
    return 'report_own';
  end if;
  perform pg_advisory_xact_lock(hashtext('fabula_report:' || v_uid::text));
  if exists (select 1 from public.fabula_reports where story_id = p_story and reporter = v_uid) then
    return 'report_already';
  end if;
  if (select count(*) from public.fabula_reports where reporter = v_uid
      and created_at >= public.fabula_today()::timestamp at time zone 'Europe/Rome') >= 5 then
    return 'report_limit';
  end if;
  insert into public.fabula_reports (story_id, reporter, reason) values (p_story, v_uid, p_reason);
  if (select count(*) from public.fabula_reports where story_id = p_story and status = 'open')
     >= public.fabula_setting('fabula_hide_after_reports', 3) then
    update public.fabula_stories set status = 'hidden', updated_at = now() where id = p_story and status = 'published';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.fabula_report(uuid, text) from public, anon;
grant execute on function public.fabula_report(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancellazione account (GDPR): anche le segnalazioni fatte restano anonime
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
  update public.mosaic_reports set reporter = null where reporter = new.id;
  delete from public.mosaic_daily_usage where user_id = new.id;
  delete from public.login_day_counts where user_id = new.id;
  delete from public.fabula_stories where user_id = new.id;
  delete from public.fabula_applause where user_id = new.id;
  update public.fabula_reports set reporter = null where reporter = new.id;
  return new;
end;
$$;

-- Scheda di una storia: anche se lo Staff l'ha resa privata (niente "Pubblica")
create or replace function public.fabula_card(p_story public.fabula_stories)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_story.id, 'roll_date', p_story.roll_date, 'dice', to_jsonb(p_story.dice), 'title', p_story.title, 'body', p_story.body,
    'locale', p_story.locale, 'status', p_story.status, 'challenge', p_story.challenge, 'created_at', p_story.created_at,
    'locked', p_story.staff_locked,
    'author_name', public.timebank_name(p_story.user_id),
    'applause', (select count(*) from public.fabula_applause a where a.story_id = p_story.id),
    'applauded', exists (select 1 from public.fabula_applause a where a.story_id = p_story.id and a.user_id = auth.uid()),
    'is_mine', p_story.user_id = auth.uid()
  );
$$;
revoke all on function public.fabula_card(public.fabula_stories) from public, anon, authenticated;
