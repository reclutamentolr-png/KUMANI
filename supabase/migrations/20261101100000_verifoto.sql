-- VeriFoto: verifica se una foto è generata o ritoccata con l'intelligenza
-- artificiale (categoria Sicurezza e Verifica, piano Base).
--
-- I controlli di base (Content Credentials, metadati, mappa dei ritocchi) si
-- fanno nel browser dell'utente: la foto non viene caricata. Il rilevatore AI
-- (Sightengine) usa solo la quota gratuita: ogni analisi riserva le
-- operazioni stimate, poi si corregge con quelle effettive lette dalla
-- risposta. Superato il tetto mensile (Admin → Impostazioni) il rilevatore si
-- ferma fino al mese dopo: non si paga mai nulla.

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('verifoto', true, 'base', 'VeriFoto – verifica se una foto è generata o ritoccata con l''intelligenza artificiale')
on conflict (tool_name) do nothing;

insert into public.system_settings (key, value) values
  ('verifoto_daily_user', '3'),
  ('verifoto_monthly_ops', '1800'),
  ('verifoto_ops_per_check', '5')
on conflict (key) do nothing;

-- Analisi del rilevatore per utente e giorno
create table if not exists public.verifoto_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  checks int not null default 0,
  primary key (user_id, used_on)
);
alter table public.verifoto_usage enable row level security;

-- Operazioni Sightengine consumate nel mese (quota gratuita)
create table if not exists public.verifoto_quota (
  month text primary key,
  ops int not null default 0
);
alter table public.verifoto_quota enable row level security;

create or replace function public.verifoto_month()
returns text
language sql
stable
as $$
  select to_char(now() at time zone 'Europe/Rome', 'YYYY-MM');
$$;

-- Prenota un'analisi del rilevatore: piano, interruttore, limite giornaliero
-- per utente e tetto mensile di operazioni.
create or replace function public.verifoto_reserve()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_month text := public.verifoto_month();
  v_limit int := greatest(coalesce(nullif(public.setting_text('verifoto_daily_user'), '')::int, 3), 0);
  v_cap int := greatest(coalesce(nullif(public.setting_text('verifoto_monthly_ops'), '')::int, 1800), 0);
  v_cost int := greatest(coalesce(nullif(public.setting_text('verifoto_ops_per_check'), '')::int, 5), 1);
  v_ops int;
  v_checks int;
begin
  if v_uid is null or not exists (select 1 from public.tool_access(v_uid, 'verifoto') t where t.allowed) then
    return jsonb_build_object('result', 'not_allowed');
  end if;
  insert into public.verifoto_quota (month) values (v_month) on conflict (month) do nothing;
  select ops into v_ops from public.verifoto_quota where month = v_month for update;
  if v_ops + v_cost > v_cap then
    return jsonb_build_object('result', 'quota');
  end if;
  insert into public.verifoto_usage (user_id, used_on) values (v_uid, v_today) on conflict (user_id, used_on) do nothing;
  select checks into v_checks from public.verifoto_usage where user_id = v_uid and used_on = v_today for update;
  if v_checks >= v_limit then
    return jsonb_build_object('result', 'user_limit', 'limit', v_limit);
  end if;
  update public.verifoto_usage set checks = checks + 1 where user_id = v_uid and used_on = v_today;
  update public.verifoto_quota set ops = ops + v_cost where month = v_month;
  return jsonb_build_object('result', 'ok', 'reserved', v_cost, 'left_today', v_limit - v_checks - 1);
end;
$$;
revoke all on function public.verifoto_reserve() from public, anon;
grant execute on function public.verifoto_reserve() to authenticated;

-- Correzione con le operazioni effettive (o rimborso se l'analisi è fallita).
-- Solo il server (client di servizio).
create or replace function public.verifoto_settle(p_user uuid, p_reserved int, p_actual int, p_failed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.verifoto_quota
    set ops = greatest(ops - coalesce(p_reserved, 0) + case when p_failed then 0 else greatest(coalesce(p_actual, p_reserved), 0) end, 0)
    where month = public.verifoto_month();
  if p_failed then
    update public.verifoto_usage set checks = greatest(checks - 1, 0)
    where user_id = p_user and used_on = (now() at time zone 'Europe/Rome')::date;
  end if;
end;
$$;
revoke all on function public.verifoto_settle(uuid, int, int, boolean) from public, anon, authenticated;
grant execute on function public.verifoto_settle(uuid, int, int, boolean) to service_role;

-- Stato per la pagina: analisi rimaste oggi e disponibilità del rilevatore
create or replace function public.verifoto_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(coalesce(nullif(public.setting_text('verifoto_daily_user'), '')::int, 3), 0);
  v_cap int := greatest(coalesce(nullif(public.setting_text('verifoto_monthly_ops'), '')::int, 1800), 0);
  v_cost int := greatest(coalesce(nullif(public.setting_text('verifoto_ops_per_check'), '')::int, 5), 1);
  v_used int;
  v_ops int;
begin
  select checks into v_used from public.verifoto_usage where user_id = v_uid and used_on = (now() at time zone 'Europe/Rome')::date;
  select ops into v_ops from public.verifoto_quota where month = public.verifoto_month();
  return jsonb_build_object(
    'left_today', greatest(v_limit - coalesce(v_used, 0), 0),
    'daily_limit', v_limit,
    'quota_available', coalesce(v_ops, 0) + v_cost <= v_cap
  );
end;
$$;
revoke all on function public.verifoto_status() from public, anon;
grant execute on function public.verifoto_status() to authenticated;

-- Punti KU giornalieri anche per VeriFoto (ultima versione: 20261015100000_events.sql)
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
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto'
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
