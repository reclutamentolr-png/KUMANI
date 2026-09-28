-- Kumani Fabula (SVAGO, gratis): sei dadi, una micro-storia.
-- Ogni giorno lo stesso lancio per tutti (deciso qui, a mezzanotte italiana);
-- le storie del lancio del giorno si possono pubblicare nella galleria, dove
-- si leggono nelle 7 lingue. Il lancio libero resta nell'archivio personale.
--
-- Moderazione senza coda quotidiana: chi ha almeno 7 giorni di accesso
-- pubblica subito; i nuovi iscritti e i testi con parole filtrate vanno in
-- attesa dello Staff; dopo 3 segnalazioni una storia si nasconde da sola.

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('fabula', true, 'free', 'Kumani Fabula – sei dadi, una micro-storia. Spento: sola lettura')
on conflict (tool_name) do nothing;

insert into public.system_settings (key, value) values
  ('fabula_min_login_days', '7'),
  ('fabula_hide_after_reports', '3')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table if not exists public.fabula_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roll_date date,                          -- lancio del giorno; null = lancio libero
  dice smallint[] not null check (array_length(dice, 1) = 6 and 0 <= all(dice) and 9 >= all(dice)),
  title text check (title is null or char_length(title) <= 80),
  body text not null check (char_length(body) between 20 and 900),
  locale text not null check (locale in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru')),
  status text not null default 'private' check (status in ('private', 'pending', 'published', 'hidden', 'removed')),
  challenge boolean not null default false, -- scritta con la sfida dei 60 secondi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Una sola storia del lancio del giorno per persona
create unique index if not exists idx_fabula_daily_once on public.fabula_stories(user_id, roll_date) where roll_date is not null;
create index if not exists idx_fabula_gallery on public.fabula_stories(roll_date, status, created_at desc);
create index if not exists idx_fabula_user on public.fabula_stories(user_id, created_at desc);

create table if not exists public.fabula_applause (
  story_id uuid not null references public.fabula_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create table if not exists public.fabula_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.fabula_stories(id) on delete cascade,
  reporter uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('offensive', 'spam', 'other')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (story_id, reporter)
);
create index if not exists idx_fabula_reports_open on public.fabula_reports(status, created_at);

-- Parole che mandano una storia in attesa dello Staff (radici, minuscole)
create table if not exists public.fabula_banned_words (
  word text primary key check (char_length(word) between 2 and 40)
);
insert into public.fabula_banned_words (word) values
  ('cazz'), ('vaffancul'), ('stronz'), ('puttan'), ('coglion'), ('frocio'), ('froci'), ('minchi'), ('zoccol'), ('pompin'),
  ('porcodio'), ('porco dio'), ('diocane'), ('dio cane'), ('bastard'),
  ('fuck'), ('shit'), ('bitch'), ('cunt'), ('asshole'), ('nigger'), ('nigga'), ('faggot'), ('whore'), ('slut'), ('retard'),
  ('putain'), ('merde'), ('connard'), ('connass'), ('salope'), ('encul'), ('fils de pute'),
  ('puta'), ('mierda'), ('cabrón'), ('cabron'), ('coño'), ('gilipoll'), ('maric'), ('pendej'), ('joder'), ('hijo de puta'),
  ('porra'), ('caralh'), ('merda'), ('foda'), ('viado'), ('buceta'), ('arrombad'), ('filho da puta'),
  ('scheiß'), ('scheiss'), ('fotze'), ('hurensohn'), ('arschloch'), ('wichser'), ('schlampe'), ('schwuchtel'),
  ('хуй'), ('хуе'), ('пизд'), ('ебат'), ('ёба'), ('бля'), ('сука'), ('мудак'), ('пидор'), ('гандон'), ('залуп')
on conflict (word) do nothing;

alter table public.fabula_stories enable row level security;
alter table public.fabula_applause enable row level security;
alter table public.fabula_reports enable row level security;
alter table public.fabula_banned_words enable row level security;

-- ---------------------------------------------------------------------------
-- Funzioni di base
-- ---------------------------------------------------------------------------
create or replace function public.fabula_setting(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when trim(coalesce(public.setting_text(p_key), '')) ~ '^\d{1,4}$'
              then trim(public.setting_text(p_key))::integer else p_default end;
$$;
revoke all on function public.fabula_setting(text, integer) from public, anon, authenticated;

create or replace function public.fabula_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- Lancio del giorno: sei facce (0..9) uguali per tutti, dalla data
create or replace function public.fabula_roll(p_date date)
returns smallint[]
language sql
immutable
as $$
  select array_agg(((('x' || substr(md5('fabula:' || p_date::text || ':' || i), 1, 8))::bit(32)::int & 2147483647) % 10)::smallint order by i)
  from generate_series(0, 5) i;
$$;

-- Il testo contiene una parola filtrata?
create or replace function public.fabula_flagged(p_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.fabula_banned_words w where lower(coalesce(p_text, '')) ~ ('\m' || w.word));
$$;
revoke all on function public.fabula_flagged(text) from public, anon, authenticated;

create or replace function public.fabula_blocked(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select coalesce(is_blocked, false) or deleted_at is not null from public.profiles where id = p_uid), true);
$$;
revoke all on function public.fabula_blocked(uuid) from public, anon, authenticated;

-- Pubblicazione immediata o in attesa dello Staff
create or replace function public.fabula_publish_status(p_uid uuid, p_title text, p_body text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce((select days from public.login_day_counts where user_id = p_uid), 0) < public.fabula_setting('fabula_min_login_days', 7) then 'pending'
    when public.fabula_flagged(coalesce(p_title, '') || ' ' || p_body) then 'pending'
    else 'published'
  end;
$$;
revoke all on function public.fabula_publish_status(uuid, text, text) from public, anon, authenticated;

-- Serie di giorni con una storia del lancio del giorno (attuale e migliore)
create or replace function public.fabula_streaks(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with d as (select distinct roll_date from public.fabula_stories where user_id = p_uid and roll_date is not null),
  g as (select roll_date, roll_date - (row_number() over (order by roll_date))::int as grp from d),
  runs as (select max(roll_date) as last_day, count(*)::int as n from g group by grp)
  select jsonb_build_object(
    'best', coalesce((select max(n) from runs), 0),
    'current', coalesce((select n from runs where last_day >= public.fabula_today() - 1 order by last_day desc limit 1), 0)
  );
$$;
revoke all on function public.fabula_streaks(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funzioni per l'utente
-- ---------------------------------------------------------------------------
create or replace function public.fabula_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.fabula_today();
  v_story public.fabula_stories;
  v_streaks jsonb;
  v_count int;
  v_days int;
begin
  if v_uid is null then
    return null;
  end if;
  select * into v_story from public.fabula_stories where user_id = v_uid and roll_date = v_today;
  v_streaks := public.fabula_streaks(v_uid);
  select count(*) into v_count from public.fabula_stories where user_id = v_uid;
  select coalesce(days, 0) into v_days from public.login_day_counts where user_id = v_uid;
  return jsonb_build_object(
    'online', public.tool_online('fabula'),
    'today', v_today,
    'dice', to_jsonb(public.fabula_roll(v_today)),
    'my_today', case when v_story.id is not null then jsonb_build_object(
      'id', v_story.id, 'status', v_story.status, 'title', v_story.title, 'body', v_story.body, 'locale', v_story.locale) end,
    'login_days', coalesce(v_days, 0),
    'min_login_days', public.fabula_setting('fabula_min_login_days', 7),
    'blocked', public.fabula_blocked(v_uid),
    'stories', v_count,
    'streak', v_streaks -> 'current',
    'best_streak', v_streaks -> 'best',
    'badges', jsonb_build_object('first_story', v_count > 0, 'steady_pen', (v_streaks ->> 'best')::int >= 7)
  );
end;
$$;
revoke all on function public.fabula_status() from public, anon;
grant execute on function public.fabula_status() to authenticated;

-- Salvare una storia (lancio del giorno o lancio libero)
create or replace function public.fabula_save(
  p_daily boolean, p_dice smallint[], p_title text, p_body text, p_locale text, p_publish boolean, p_challenge boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.fabula_today();
  v_title text := nullif(left(trim(coalesce(p_title, '')), 80), '');
  v_body text := left(trim(coalesce(p_body, '')), 900);
  v_dice smallint[];
  v_status text := 'private';
  v_id uuid;
begin
  perform public.tool_require_online('fabula');
  if v_uid is null or public.fabula_blocked(v_uid) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if char_length(v_body) < 20 then
    return jsonb_build_object('error', 'too_short');
  end if;
  if coalesce(p_locale, '') not in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru') then
    return jsonb_build_object('error', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtext('fabula:' || v_uid::text));
  if (select count(*) from public.fabula_stories where user_id = v_uid
      and created_at >= v_today::timestamp at time zone 'Europe/Rome') >= 10 then
    return jsonb_build_object('error', 'too_many');
  end if;
  if coalesce(p_daily, false) then
    if exists (select 1 from public.fabula_stories where user_id = v_uid and roll_date = v_today) then
      return jsonb_build_object('error', 'already_today');
    end if;
    v_dice := public.fabula_roll(v_today);
    if coalesce(p_publish, false) then
      v_status := public.fabula_publish_status(v_uid, v_title, v_body);
    end if;
  else
    if p_dice is null or array_length(p_dice, 1) <> 6 or not (0 <= all(p_dice) and 9 >= all(p_dice)) then
      return jsonb_build_object('error', 'invalid');
    end if;
    v_dice := p_dice;
  end if;
  insert into public.fabula_stories (user_id, roll_date, dice, title, body, locale, status, challenge)
  values (v_uid, case when coalesce(p_daily, false) then v_today end, v_dice, v_title, v_body, p_locale, v_status, coalesce(p_challenge, false))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;
revoke all on function public.fabula_save(boolean, smallint[], text, text, text, boolean, boolean) from public, anon;
grant execute on function public.fabula_save(boolean, smallint[], text, text, text, boolean, boolean) to authenticated;

-- Pubblicare o ritirare dalla galleria una propria storia del lancio del giorno
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
  if v_story.id is null or v_story.roll_date is null or v_story.status in ('hidden', 'removed') or public.fabula_blocked(v_uid) then
    return 'not_allowed';
  end if;
  v_status := case when p_publish then public.fabula_publish_status(v_uid, v_story.title, v_story.body) else 'private' end;
  update public.fabula_stories set status = v_status, updated_at = now() where id = p_story;
  return v_status;
end;
$$;
revoke all on function public.fabula_set_published(uuid, boolean) from public, anon;
grant execute on function public.fabula_set_published(uuid, boolean) to authenticated;

create or replace function public.fabula_delete(p_story uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fabula_stories where id = p_story and user_id = auth.uid();
  return case when found then 'ok' else 'not_allowed' end;
end;
$$;
revoke all on function public.fabula_delete(uuid) from public, anon;
grant execute on function public.fabula_delete(uuid) to authenticated;

-- Scheda di una storia per la galleria e l'archivio
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
    'author_name', public.timebank_name(p_story.user_id),
    'applause', (select count(*) from public.fabula_applause a where a.story_id = p_story.id),
    'applauded', exists (select 1 from public.fabula_applause a where a.story_id = p_story.id and a.user_id = auth.uid()),
    'is_mine', p_story.user_id = auth.uid()
  );
$$;
revoke all on function public.fabula_card(public.fabula_stories) from public, anon, authenticated;

-- Galleria di un giorno (di serie oggi), in ordine di arrivo: niente classifiche
create or replace function public.fabula_gallery(p_date date, p_locale text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with day as (select coalesce(p_date, public.fabula_today()) as d),
  visible as (
    select s.* from public.fabula_stories s
    join public.profiles pr on pr.id = s.user_id, day
    where s.roll_date = day.d and s.status = 'published'
      and not coalesce(pr.is_blocked, false) and pr.deleted_at is null
  )
  select jsonb_build_object(
    'date', (select d from day),
    'dice', to_jsonb(public.fabula_roll((select d from day))),
    'locales', coalesce((select jsonb_object_agg(locale, n) from (select locale, count(*) as n from visible group by locale) l), '{}'::jsonb),
    'stories', coalesce((
      select jsonb_agg(public.fabula_card(v) order by v.created_at desc)
      from (select * from visible where coalesce(p_locale, '') = '' or locale = p_locale order by created_at desc limit 300) v
    ), '[]'::jsonb)
  )
  where auth.uid() is not null and (select d from day) <= public.fabula_today();
$$;
revoke all on function public.fabula_gallery(date, text) from public, anon;
grant execute on function public.fabula_gallery(date, text) to authenticated;

-- Il mio archivio
create or replace function public.fabula_my()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.fabula_card(s) order by s.created_at desc), '[]'::jsonb)
  from (select * from public.fabula_stories where user_id = auth.uid() and status <> 'removed' order by created_at desc limit 200) s;
$$;
revoke all on function public.fabula_my() from public, anon;
grant execute on function public.fabula_my() to authenticated;

-- Applauso (uno per persona, si può togliere; non sulle proprie storie)
create or replace function public.fabula_applaud(p_story uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.fabula_blocked(v_uid) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if not exists (select 1 from public.fabula_stories where id = p_story and status = 'published' and user_id <> v_uid) then
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

-- Segnalazione: una per storia, al massimo 5 al giorno; dopo N segnalazioni
-- la storia si nasconde da sola in attesa dello Staff
create or replace function public.fabula_report(p_story uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.fabula_blocked(v_uid) then
    return 'not_allowed';
  end if;
  if coalesce(p_reason, '') not in ('offensive', 'spam', 'other') then
    return 'invalid';
  end if;
  if not exists (select 1 from public.fabula_stories where id = p_story and status = 'published') then
    return 'not_found';
  end if;
  if exists (select 1 from public.fabula_stories where id = p_story and user_id = v_uid) then
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
-- Cancellazione account (GDPR): le storie e gli applausi se ne vanno
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
  delete from public.fabula_stories where user_id = new.id;
  delete from public.fabula_applause where user_id = new.id;
  return new;
end;
$$;

-- Punti KU giornalieri anche per Fabula
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
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula'
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

-- Pallino oro in Admin: storie in attesa, nascoste o segnalate
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
    'mosaic', nullif((select count(*) from public.mosaic_reports where status = 'open' and created_at > coalesce((seen ->> 'mosaic')::timestamptz, v_default)), 0),
    'fabula', nullif((select count(*) from public.fabula_stories where status in ('pending', 'hidden') and updated_at > coalesce((seen ->> 'fabula')::timestamptz, v_default))
                   + (select count(*) from public.fabula_reports where status = 'open' and created_at > coalesce((seen ->> 'fabula')::timestamptz, v_default)), 0)
  ));
end;
$$;
