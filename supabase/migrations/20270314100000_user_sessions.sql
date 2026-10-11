-- Sessioni d'uso: per il «Tempo medio per sessione» nelle statistiche dell'Admin.
-- Una sessione = una visita di un utente collegato; finisce dopo 30 minuti
-- senza attività. Il browser manda un segnale al minuto solo con la pagina
-- in primo piano (più uno quando si esce): il tempo conta solo quello attivo.
-- Lo Staff non viene contato. Le righe si cancellano da sole dopo 13 mesi.

create table if not exists public.user_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  active_seconds integer not null default 0,
  pings integer not null default 1,
  device text not null default 'desktop' check (device in ('mobile', 'desktop'))
);
create index if not exists user_sessions_user_last_idx on public.user_sessions (user_id, last_active_at desc);
create index if not exists user_sessions_started_idx on public.user_sessions (started_at);
alter table public.user_sessions enable row level security;
-- Nessuna regola di lettura: si scrive solo con session_ping e si legge solo dall'Admin (chiave di servizio)

create or replace function public.session_ping(p_device text default 'desktop')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.user_sessions%rowtype;
  v_delta integer;
begin
  if v_uid is null or public.admin_is_staff(v_uid) then
    return;
  end if;
  -- Segnali contemporanei dello stesso utente (pagina che si chiude e pagina
  -- che si apre) uno alla volta: altrimenti nascerebbero due sessioni
  perform pg_advisory_xact_lock(hashtext('session_ping:' || v_uid::text));
  select * into v_session
  from public.user_sessions
  where user_id = v_uid and last_active_at > now() - interval '30 minutes'
  order by last_active_at desc
  limit 1
  for update;
  if not found then
    insert into public.user_sessions (user_id, device)
    values (v_uid, case when p_device = 'mobile' then 'mobile' else 'desktop' end);
    return;
  end if;
  -- Più schede aperte mandano segnali vicini: si conta solo il tempo davvero passato
  if now() - v_session.last_active_at < interval '15 seconds' then
    return;
  end if;
  -- Al massimo 2 minuti per segnale: un buco più lungo non è tempo d'uso
  v_delta := least(extract(epoch from now() - v_session.last_active_at)::integer, 120);
  update public.user_sessions
  set last_active_at = now(),
      active_seconds = active_seconds + v_delta,
      pings = pings + 1
  where id = v_session.id;
end;
$$;
revoke all on function public.session_ping(text) from public, anon;
grant execute on function public.session_ping(text) to authenticated;

-- Statistiche per l'Admin (solo chiave di servizio): periodo scelto e periodo precedente
create or replace function public.admin_session_stats(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select greatest(1, least(coalesce(p_days, 30), 366)) as days
  ),
  cur as (
    select s.* from public.user_sessions s, params
    where s.started_at >= now() - make_interval(days => params.days)
  ),
  prev as (
    select s.* from public.user_sessions s, params
    where s.started_at >= now() - make_interval(days => params.days * 2)
      and s.started_at < now() - make_interval(days => params.days)
  ),
  daily as (
    select (started_at at time zone 'Europe/Rome')::date as day,
           count(*) as sessions,
           count(distinct user_id) as users,
           round(avg(active_seconds))::integer as avg_seconds
    from cur
    group by 1
    order by 1
  ),
  buckets as (
    select case
             when active_seconds < 10 then 'lt10s'
             when active_seconds < 60 then 'lt1m'
             when active_seconds < 300 then 'lt5m'
             when active_seconds < 900 then 'lt15m'
             else 'gte15m'
           end as bucket,
           count(*) as sessions
    from cur
    group by 1
  )
  select jsonb_build_object(
    'days', (select days from params),
    'sessions', (select count(*) from cur),
    'users', (select count(distinct user_id) from cur),
    'avg_seconds', (select coalesce(round(avg(active_seconds)), 0)::integer from cur),
    'median_seconds', (select coalesce(percentile_cont(0.5) within group (order by active_seconds), 0)::integer from cur),
    'total_seconds', (select coalesce(sum(active_seconds), 0) from cur),
    'mobile_sessions', (select count(*) from cur where device = 'mobile'),
    'mobile_avg_seconds', (select coalesce(round(avg(active_seconds)), 0)::integer from cur where device = 'mobile'),
    'desktop_avg_seconds', (select coalesce(round(avg(active_seconds)), 0)::integer from cur where device = 'desktop'),
    'prev_sessions', (select count(*) from prev),
    'prev_users', (select count(distinct user_id) from prev),
    'prev_avg_seconds', (select coalesce(round(avg(active_seconds)), 0)::integer from prev),
    'buckets', coalesce((select jsonb_object_agg(bucket, sessions) from buckets), '{}'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'sessions', sessions, 'users', users, 'avg_seconds', avg_seconds)) from daily), '[]'::jsonb),
    'first_session', (select min(started_at) from public.user_sessions)
  );
$$;
revoke all on function public.admin_session_stats(integer) from public, anon, authenticated;

-- Pulizia: sessioni più vecchie di 13 mesi
create or replace function public.user_sessions_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_sessions where started_at < now() - interval '13 months';
$$;
revoke all on function public.user_sessions_cleanup() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'kumani-sessions-cleanup';
    perform cron.schedule('kumani-sessions-cleanup', '50 3 * * *', 'select public.user_sessions_cleanup()');
  end if;
end;
$$;
