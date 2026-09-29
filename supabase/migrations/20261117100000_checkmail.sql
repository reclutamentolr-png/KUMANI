-- KUMANI CheckMail (Sicurezza e Verifica): analisi di un'email sospetta.
-- L'email è analizzata in memoria e NON viene salvata: nel database resta
-- solo quante analisi ha fatto ciascuno oggi (per il limite giornaliero).

-- Strumento (piano Base, come SVAT e VeriFoto) e limite giornaliero
insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('checkmail', true, 'base', 'CheckMail – analisi di email sospette')
on conflict (tool_name) do nothing;

insert into public.system_settings (key, value)
values ('checkmail_daily_user', '10')
on conflict (key) do nothing;

-- Analisi fatte oggi da ciascun utente
create table if not exists public.checkmail_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  checks int not null default 0,
  primary key (user_id, used_on)
);
alter table public.checkmail_usage enable row level security;
-- Nessuna policy: si legge e si scrive solo con le funzioni qui sotto.

create or replace function public.checkmail_today() returns date
language sql stable set search_path = public
as $$ select (now() at time zone 'Europe/Rome')::date $$;

-- Prenota un'analisi: controlla piano e limite, poi conta.
create or replace function public.checkmail_reserve()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(coalesce(nullif(public.setting_text('checkmail_daily_user'), '')::int, 10), 0);
  v_used int;
begin
  if v_uid is null or not exists (select 1 from public.tool_access(v_uid, 'checkmail') t where t.allowed) then
    return jsonb_build_object('result', 'not_allowed');
  end if;

  insert into public.checkmail_usage (user_id, used_on, checks)
  values (v_uid, public.checkmail_today(), 0)
  on conflict (user_id, used_on) do nothing;

  select checks into v_used from public.checkmail_usage
  where user_id = v_uid and used_on = public.checkmail_today()
  for update;

  if v_used >= v_limit then
    return jsonb_build_object('result', 'user_limit', 'left_today', 0);
  end if;

  update public.checkmail_usage set checks = checks + 1
  where user_id = v_uid and used_on = public.checkmail_today();

  return jsonb_build_object('result', 'ok', 'left_today', v_limit - v_used - 1);
end;
$$;
revoke all on function public.checkmail_reserve() from public, anon;
grant execute on function public.checkmail_reserve() to authenticated;

-- Restituisce l'analisi prenotata se è fallita per un errore tecnico
-- (solo dal server, con il ruolo di servizio).
create or replace function public.checkmail_refund(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.checkmail_usage set checks = greatest(checks - 1, 0)
  where user_id = p_user and used_on = public.checkmail_today();
$$;
revoke all on function public.checkmail_refund(uuid) from public, anon, authenticated;
grant execute on function public.checkmail_refund(uuid) to service_role;

-- Quante analisi restano oggi
create or replace function public.checkmail_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'daily_limit', greatest(coalesce(nullif(public.setting_text('checkmail_daily_user'), '')::int, 10), 0),
    'left_today', greatest(
      greatest(coalesce(nullif(public.setting_text('checkmail_daily_user'), '')::int, 10), 0)
      - coalesce((select checks from public.checkmail_usage where user_id = auth.uid() and used_on = public.checkmail_today()), 0),
      0)
  );
$$;
revoke all on function public.checkmail_status() from public, anon;
grant execute on function public.checkmail_status() to authenticated;

-- Punti KU giornalieri anche per CheckMail (ultima versione + 'checkmail')
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
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail'
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
