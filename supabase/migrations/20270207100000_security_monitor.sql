-- Sicurezza: registro degli eventi sospetti, avvisi per l'Admin e IP
-- bloccati (Admin → Sicurezza).
-- - security_events: cosa è successo (scansioni in cerca di falle, pagine
--   inesistenti, accessi falliti, tentativi sull'Admin, limiti superati,
--   accessi riusciti copiati da auth.sessions…). Solo il server scrive e
--   legge (nessuna regola RLS per gli utenti). Tenuti 30 giorni (impostabile).
-- - security_alerts: gli avvisi da guardare, uno per problema (stessa chiave
--   = stesso avviso, con il numero di volte). Stato aperto / risolto /
--   ignorato (un avviso ignorato non torna per 7 giorni).
-- - blocked_ips: indirizzi bloccati dall'Admin, con scadenza.
-- Le soglie stanno in app_limits (sezione «Sicurezza», Admin → Limiti e
-- pulizia). Controllo ogni ora (pg_cron) per i comportamenti degli utenti;
-- gli eventi registrati dal sito fanno scattare subito gli avvisi.

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  severity text not null default 'info' check (severity in ('info', 'low', 'medium', 'high')),
  user_id uuid references auth.users(id) on delete set null,
  ip text,
  path text,
  user_agent text,
  ref text,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists security_events_created_idx on public.security_events (created_at desc);
create index if not exists security_events_kind_idx on public.security_events (kind, created_at desc);
create index if not exists security_events_ip_idx on public.security_events (ip, created_at desc) where ip is not null;
create index if not exists security_events_user_idx on public.security_events (user_id, created_at desc) where user_id is not null;
create unique index if not exists security_events_ref_key on public.security_events (kind, ref) where ref is not null;
alter table public.security_events enable row level security;

create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  dedupe_key text not null,
  title text not null,
  user_id uuid references auth.users(id) on delete set null,
  ip text,
  count integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  notified_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create unique index if not exists security_alerts_open_key on public.security_alerts (dedupe_key) where status = 'open';
create index if not exists security_alerts_status_idx on public.security_alerts (status, last_seen desc);
alter table public.security_alerts enable row level security;

create table if not exists public.blocked_ips (
  ip text primary key,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz
);
alter table public.blocked_ips enable row level security;

-- Soglie (Admin → Limiti e pulizia, sezione Sicurezza) e durata del registro
insert into public.app_limits (key, value, kind, section, label, sort) values
  ('sec_probe_ip_hour', 3, 'count', 'Sicurezza', 'Scansioni in cerca di falle da un IP in un''ora (avviso grave)', 400),
  ('sec_notfound_ip_hour', 40, 'count', 'Sicurezza', 'Pagine inesistenti aperte da un IP in un''ora', 401),
  ('sec_login_fail_ip', 8, 'count', 'Sicurezza', 'Accessi falliti da un IP in 15 minuti', 402),
  ('sec_login_fail_email', 10, 'count', 'Sicurezza', 'Accessi falliti sulla stessa email in un''ora (avviso grave)', 403),
  ('sec_password_fail_user', 5, 'count', 'Sicurezza', 'Password attuale sbagliata (cambio password) in un''ora', 404),
  ('sec_limit_hits_hour', 10, 'count', 'Sicurezza', 'Limiti superati da una persona in un''ora', 405),
  ('sec_mass_create_hour', 150, 'count', 'Sicurezza', 'Elementi creati in un servizio da una persona in un''ora (contatti ×10)', 406),
  ('sec_ai_cap_days', 4, 'count', 'Sicurezza', 'Giorni su 7 con l''AI usata fino al limite', 407),
  ('sec_reports_week', 3, 'count', 'Sicurezza', 'Persone diverse che segnalano lo stesso utente in 7 giorni', 408),
  ('sec_login_ips_day', 5, 'count', 'Sicurezza', 'Indirizzi IP diversi negli accessi di una persona in 24 ore (account condiviso)', 409),
  ('sec_signups_ip_day', 3, 'count', 'Sicurezza', 'Nuovi account dallo stesso IP in 24 ore', 410),
  ('sec_invitees_same_ip', 2, 'count', 'Sicurezza', 'Invitati dello stesso sponsor con lo stesso IP (avviso grave)', 411),
  ('sec_trials_ip_day', 3, 'count', 'Sicurezza', 'Prove gratuite avviate dallo stesso IP in 24 ore', 412),
  ('sec_point_awards_day', 10, 'count', 'Sicurezza', 'KU Points ricevuti da una persona in 24 ore (numero di accrediti)', 413),
  ('days_security_events', 30, 'days', 'Pulizia automatica', 'Registro di sicurezza: eventi e indirizzi IP (giorni)', 310)
on conflict (key) do nothing;

create or replace function public.sec_th(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.app_limit(p_key), p_default)
$$;
revoke all on function public.sec_th(text, integer) from public, anon, authenticated;

create or replace function public.sec_rank(p_severity text)
returns integer
language sql
immutable
as $$
  select case p_severity when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end
$$;

-- Apre (o aggiorna) un avviso. Ritorna l'avviso se è nuovo, altrimenti niente.
create or replace function public.security_raise(
  p_kind text,
  p_severity text,
  p_key text,
  p_title text,
  p_user uuid default null,
  p_ip text default null,
  p_detail jsonb default '{}'::jsonb
)
returns table (alert_id uuid, severity text, title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_new boolean;
begin
  -- Ignorato di recente: non torna per 7 giorni
  if exists (
    select 1 from public.security_alerts a
    where a.dedupe_key = p_key and a.status = 'ignored' and a.resolved_at > now() - interval '7 days'
  ) then
    return;
  end if;
  insert into public.security_alerts as a (kind, severity, dedupe_key, title, user_id, ip, detail)
  values (p_kind, p_severity, p_key, p_title, p_user, p_ip, coalesce(p_detail, '{}'::jsonb))
  on conflict (dedupe_key) where status = 'open' do update
    set count = a.count + 1,
        last_seen = now(),
        title = excluded.title,
        detail = a.detail || excluded.detail,
        severity = case when public.sec_rank(excluded.severity) > public.sec_rank(a.severity) then excluded.severity else a.severity end
  returning a.id, (xmax = 0) into v_id, v_new;
  if v_new then
    return query select v_id, p_severity, p_title;
  end if;
end;
$$;
revoke all on function public.security_raise(text, text, text, text, uuid, text, jsonb) from public, anon, authenticated;

-- Registra un evento dal sito e controlla subito le soglie. Ritorna gli
-- avvisi nuovi (il sito manda la notifica agli admin per quelli importanti).
create or replace function public.security_log(
  p_kind text,
  p_severity text default 'info',
  p_user uuid default null,
  p_ip text default null,
  p_path text default null,
  p_user_agent text default null,
  p_detail jsonb default '{}'::jsonb,
  p_ref text default null
)
returns table (alert_id uuid, severity text, title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
  v_email text := lower(nullif(p_detail ->> 'email', ''));
begin
  -- Freno contro chi inonda il registro: oltre 500 eventi uguali in un'ora
  -- dallo stesso IP o dalla stessa persona non si registra altro
  if p_ip is not null and (
    select count(*) from public.security_events e
    where e.ip = p_ip and e.kind = p_kind and e.created_at > now() - interval '1 hour'
  ) >= 500 then
    return;
  end if;

  insert into public.security_events (kind, severity, user_id, ip, path, user_agent, detail, ref)
  values (p_kind, coalesce(p_severity, 'info'), p_user, p_ip, left(p_path, 500), left(p_user_agent, 300), coalesce(p_detail, '{}'::jsonb), p_ref)
  on conflict (kind, ref) where ref is not null do nothing;

  if p_kind = 'probe' and p_ip is not null then
    select count(*) into v_n from public.security_events e where e.kind = 'probe' and e.ip = p_ip and e.created_at > now() - interval '1 hour';
    if v_n >= public.sec_th('sec_probe_ip_hour', 3) then
      return query select * from public.security_raise('probe', 'high', 'probe:' || p_ip,
        format('Scansione in cerca di falle: %s indirizzi da hacker in un''ora dall''IP %s', v_n, p_ip), null, p_ip,
        jsonb_build_object('last_path', p_path, 'events_hour', v_n));
    end if;

  elsif p_kind = 'not_found' and p_ip is not null then
    select count(*) into v_n from public.security_events e where e.kind = 'not_found' and e.ip = p_ip and e.created_at > now() - interval '1 hour';
    if v_n >= public.sec_th('sec_notfound_ip_hour', 40) then
      return query select * from public.security_raise('not_found', 'medium', 'not_found:' || p_ip,
        format('%s pagine inesistenti in un''ora dall''IP %s (possibile esplorazione del sito)', v_n, p_ip), null, p_ip,
        jsonb_build_object('last_path', p_path, 'events_hour', v_n));
    end if;

  elsif p_kind = 'login_failed' then
    if p_ip is not null then
      select count(*) into v_n from public.security_events e where e.kind = 'login_failed' and e.ip = p_ip and e.created_at > now() - interval '15 minutes';
      if v_n >= public.sec_th('sec_login_fail_ip', 8) then
        return query select * from public.security_raise('login_failed_ip', 'medium', 'login_ip:' || p_ip,
          format('%s accessi falliti in 15 minuti dall''IP %s', v_n, p_ip), null, p_ip,
          jsonb_build_object('last_email', v_email, 'events_15min', v_n));
      end if;
    end if;
    if v_email is not null then
      select count(*) into v_n from public.security_events e where e.kind = 'login_failed' and lower(e.detail ->> 'email') = v_email and e.created_at > now() - interval '1 hour';
      if v_n >= public.sec_th('sec_login_fail_email', 10) then
        return query select * from public.security_raise('login_failed_email', 'high', 'login_email:' || v_email,
          format('%s accessi falliti in un''ora sull''account %s (qualcuno prova a indovinare la password)', v_n, v_email),
          (select u.id from auth.users u where lower(u.email) = v_email limit 1), p_ip,
          jsonb_build_object('email', v_email, 'last_ip', p_ip, 'events_hour', v_n));
      end if;
    end if;

  elsif p_kind = 'password_check_failed' and p_user is not null then
    select count(*) into v_n from public.security_events e where e.kind = 'password_check_failed' and e.user_id = p_user and e.created_at > now() - interval '1 hour';
    if v_n >= public.sec_th('sec_password_fail_user', 5) then
      return query select * from public.security_raise('password_check_failed', 'medium', 'password_check:' || p_user,
        format('%s volte password attuale sbagliata nel cambio password in un''ora (account forse in mano ad altri)', v_n), p_user, p_ip,
        jsonb_build_object('events_hour', v_n));
    end if;

  elsif p_kind = 'admin_denied' and p_user is not null then
    return query select * from public.security_raise('admin_denied', 'medium', 'admin_denied:' || p_user,
      'Ha provato ad aprire l''Admin senza esserne autorizzato', p_user, p_ip, jsonb_build_object('last_path', p_path));

  elsif p_kind = 'admin_action_denied' and p_user is not null then
    return query select * from public.security_raise('admin_action_denied', 'high', 'admin_action:' || p_user,
      'Ha chiamato direttamente funzioni riservate all''Admin (tentativo di intrusione)', p_user, p_ip, p_detail);

  elsif p_kind = 'limit_hit' and p_user is not null then
    select count(*) into v_n from public.security_events e where e.kind = 'limit_hit' and e.user_id = p_user and e.created_at > now() - interval '1 hour';
    if v_n >= public.sec_th('sec_limit_hits_hour', 10) then
      return query select * from public.security_raise('limit_hit', 'low', 'limit_hit:' || p_user,
        format('%s limiti superati in un''ora (uso forzato o automatico)', v_n), p_user, p_ip,
        jsonb_build_object('last_limit', p_detail ->> 'key', 'events_hour', v_n));
    end if;

  elsif p_kind = 'ai_limit' and p_user is not null then
    select count(distinct (e.created_at at time zone 'Europe/Rome')::date) into v_n
    from public.security_events e where e.kind = 'ai_limit' and e.user_id = p_user and e.created_at > now() - interval '7 days';
    if v_n >= public.sec_th('sec_ai_cap_days', 4) then
      return query select * from public.security_raise('ai_limit', 'low', 'ai_limit:' || p_user,
        format('AI usata fino al limite giornaliero in %s giorni su 7', v_n), p_user, p_ip,
        jsonb_build_object('last_tool', p_detail ->> 'tool', 'days', v_n));
    end if;

  elsif p_kind = 'trial_start' and p_ip is not null then
    select count(*) into v_n from public.security_events e where e.kind = 'trial_start' and e.ip = p_ip and e.created_at > now() - interval '24 hours';
    if v_n >= public.sec_th('sec_trials_ip_day', 3) then
      return query select * from public.security_raise('trial_ip', 'medium', 'trial_ip:' || p_ip,
        format('%s prove gratuite avviate in 24 ore dallo stesso IP %s', v_n, p_ip), null, p_ip,
        jsonb_build_object('events_day', v_n));
    end if;
  end if;
end;
$$;
revoke all on function public.security_log(text, text, uuid, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.security_log(text, text, uuid, text, text, text, jsonb, text) to service_role;

-- Controllo orario sui comportamenti (accessi, inviti, creazioni in massa,
-- segnalazioni, punti). Ritorna quanti avvisi nuovi ha aperto.
create or replace function public.security_scan()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer := 0;
  v_rows integer;
  r record;
  t record;
begin
  -- 1. Accessi riusciti: copiati dalle sessioni di Supabase (IP e browser)
  insert into public.security_events (created_at, kind, severity, user_id, ip, user_agent, ref)
  select s.created_at, 'login', 'info', s.user_id, host(s.ip), left(s.user_agent, 300), s.id::text
  from auth.sessions s
  where s.ip is not null
    and s.created_at > coalesce(
      (select max(e.created_at) from public.security_events e where e.kind = 'login') - interval '3 hours',
      now() - interval '30 days')
  on conflict (kind, ref) where ref is not null do nothing;

  -- 2. Account condiviso: troppi IP diversi negli accessi di 24 ore
  for r in
    select e.user_id, count(distinct e.ip) n, array_agg(distinct e.ip) ips
    from public.security_events e
    where e.kind = 'login' and e.created_at > now() - interval '24 hours' and e.user_id is not null
      and not exists (select 1 from public.profiles g where g.id = e.user_id and g.guest_until is not null)
    group by e.user_id
    having count(distinct e.ip) >= public.sec_th('sec_login_ips_day', 5)
  loop
    perform 1 from public.security_raise('shared_account', 'medium', 'shared:' || r.user_id,
      format('Accessi da %s indirizzi IP diversi in 24 ore (account condiviso o rubato?)', r.n), r.user_id, null,
      jsonb_build_object('ips', to_jsonb(r.ips)));
    get diagnostics v_rows = row_count; v_new := v_new + v_rows;
  end loop;

  -- 3. Tanti nuovi account dallo stesso IP (primo accesso nelle 24 ore)
  for r in
    with firsts as (
      select distinct on (e.user_id) e.user_id, e.ip
      from public.security_events e
      join public.profiles p on p.id = e.user_id
      where e.kind = 'login' and p.created_at > now() - interval '24 hours' and p.guest_until is null
      order by e.user_id, e.created_at
    )
    select f.ip, count(*) n, array_agg(f.user_id) users from firsts f
    group by f.ip having count(*) >= public.sec_th('sec_signups_ip_day', 3)
  loop
    perform 1 from public.security_raise('signups_ip', 'medium', 'signups_ip:' || r.ip,
      format('%s nuovi account in 24 ore dallo stesso IP %s (account multipli?)', r.n, r.ip), null, r.ip,
      jsonb_build_object('users', to_jsonb(r.users)));
    get diagnostics v_rows = row_count; v_new := v_new + v_rows;
  end loop;

  -- 4. Inviti: l'invitato entra dallo stesso IP del suo sponsor
  for r in
    select distinct p.id user_id, p.sponsor_id, e.ip
    from public.profiles p
    join public.security_events e on e.user_id = p.id and e.kind = 'login' and e.created_at < p.created_at + interval '2 days'
    join public.security_events s on s.user_id = p.sponsor_id and s.kind = 'login' and s.ip = e.ip
    where p.sponsor_id is not null and p.created_at > now() - interval '7 days'
  loop
    perform 1 from public.security_raise('referral_same_ip', 'medium', 'ref_ip:' || r.user_id,
      format('Invitato entrato dallo stesso IP %s del suo sponsor: auto-invito per i punti oppure stessa casa o ufficio', r.ip), r.user_id, r.ip,
      jsonb_build_object('sponsor_id', r.sponsor_id));
    get diagnostics v_rows = row_count; v_new := v_new + v_rows;
  end loop;

  -- 5. Inviti: più invitati dello stesso sponsor con lo stesso IP
  for r in
    select p.sponsor_id, e.ip, count(distinct p.id) n, array_agg(distinct p.id) users
    from public.profiles p
    join public.security_events e on e.user_id = p.id and e.kind = 'login'
    where p.sponsor_id is not null and p.created_at > now() - interval '30 days'
    group by p.sponsor_id, e.ip
    having count(distinct p.id) >= public.sec_th('sec_invitees_same_ip', 2)
  loop
    perform 1 from public.security_raise('referral_cluster', 'high', 'ref_cluster:' || r.sponsor_id || ':' || r.ip,
      format('%s invitati dello stesso sponsor entrano dallo stesso IP %s (account creati dalla stessa persona?)', r.n, r.ip), r.sponsor_id, r.ip,
      jsonb_build_object('invitees', to_jsonb(r.users)));
    get diagnostics v_rows = row_count; v_new := v_new + v_rows;
  end loop;

  -- 6. Creazioni in massa nei servizi (un'ora)
  for t in
    select * from (values
      ('appointments', 'MemoLife: appuntamenti', 1), ('tasks', 'MemoLife: promemoria', 1), ('notes', 'MemoLife: note', 1),
      ('contacts', 'MemoLife: contatti', 10), ('findo_items', 'Findo: oggetti', 1), ('spendly_variable_expenses', 'Spendly: spese', 1),
      ('quotes', 'Preventivi', 1), ('quote_clients', 'Clienti dei preventivi', 1), ('digital_receipts', 'Ricevute digitali', 1),
      ('listings', 'Bacheca: annunci', 1), ('life_calendar_items', 'Life Calendar', 1), ('qr_codes', 'QR Code', 1)
    ) v(tbl, label, factor)
  loop
    if exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = 'created_at')
       and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = 'user_id') then
      for r in execute format(
        'select user_id, count(*) n from public.%I where created_at > now() - interval ''1 hour'' and user_id is not null group by user_id having count(*) >= $1',
        t.tbl) using public.sec_th('sec_mass_create_hour', 150) * t.factor
      loop
        perform 1 from public.security_raise('mass_create', 'medium', 'mass:' || t.tbl || ':' || r.user_id,
          format('%s: %s elementi creati in un''ora (uso automatico?)', t.label, r.n), r.user_id, null,
          jsonb_build_object('table', t.tbl, 'count', r.n));
        get diagnostics v_rows = row_count; v_new := v_new + v_rows;
      end loop;
    end if;
  end loop;

  -- 7. Utente segnalato da più persone diverse in 7 giorni
  for r in
    with reports as (
      select reported target, reporter::text who from public.affinity_reports where created_at > now() - interval '7 days'
      union all select target_user, reporter::text from public.timebank_reports where created_at > now() - interval '7 days' and target_user is not null
      union all select l.user_id, lr.reporter_id::text from public.listing_reports lr join public.listings l on l.id = lr.listing_id where lr.created_at > now() - interval '7 days'
      union all select f.user_id, fr.reporter::text from public.fabula_reports fr join public.fabula_stories f on f.id = fr.story_id where fr.created_at > now() - interval '7 days'
      union all select owner_id, reporter_hash from public.landing_reports where created_at > now() - interval '7 days'
    )
    select target, count(distinct who) n from reports where target is not null
    group by target having count(distinct who) >= public.sec_th('sec_reports_week', 3)
  loop
    perform 1 from public.security_raise('reported', 'medium', 'reports:' || r.target,
      format('Segnalato da %s persone diverse in 7 giorni', r.n), r.target, null, jsonb_build_object('reporters', r.n));
    get diagnostics v_rows = row_count; v_new := v_new + v_rows;
  end loop;

  -- 8. KU Points: troppi accrediti in 24 ore
  for r in
    select a.user_id, count(*) n, sum(a.points) pts
    from public.network_point_awards a
    where a.created_at > now() - interval '24 hours' and a.reversed_at is null
    group by a.user_id having count(*) >= public.sec_th('sec_point_awards_day', 10)
  loop
    perform 1 from public.security_raise('points_burst', 'low', 'points:' || r.user_id,
      format('%s accrediti di KU Points in 24 ore (%s punti): da controllare', r.n, r.pts), r.user_id, null,
      jsonb_build_object('awards', r.n, 'points', r.pts));
    get diagnostics v_rows = row_count; v_new := v_new + v_rows;
  end loop;

  -- 9. Blocchi IP scaduti
  delete from public.blocked_ips where expires_at is not null and expires_at < now();

  return v_new;
end;
$$;
revoke all on function public.security_scan() from public, anon, authenticated;

-- Pulizia notturna del registro (giorni in app_limits) e degli avvisi chiusi
create or replace function public.security_cleanup()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.security_events where created_at < now() - make_interval(days => public.sec_th('days_security_events', 30));
  delete from public.security_alerts where status <> 'open' and coalesce(resolved_at, last_seen) < now() - interval '180 days';
  delete from public.blocked_ips where expires_at is not null and expires_at < now();
end;
$$;
revoke all on function public.security_cleanup() from public, anon, authenticated;

-- Pallino nel menu dell'Admin: avvisi aperti medi o gravi
create or replace function public.admin_security_badge()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is not null and public.admin_is_staff(auth.uid())
    then (select count(*)::integer from public.security_alerts where status = 'open' and severity in ('medium', 'high'))
    else 0 end
$$;
revoke all on function public.admin_security_badge() from public, anon;
grant execute on function public.admin_security_badge() to authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('kumani-security-scan', 'kumani-security-cleanup');
  perform cron.schedule('kumani-security-scan', '5 * * * *', 'select public.security_scan()');
  perform cron.schedule('kumani-security-cleanup', '50 2 * * *', 'select public.security_cleanup()');
end;
$$;
