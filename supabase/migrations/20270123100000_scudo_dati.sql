-- Scudo Dati (Sicurezza, gratis per tutti): controlla se un'email è finita
-- in una fuga di dati (XposedOrNot) e, solo nel browser, se una password è
-- già circolata (Pwned Passwords, k-anonimato: non arriva mai al server).
--
-- Nel database NON si salvano email: la cache usa l'impronta sha256
-- dell'email in minuscolo (calcolata dal server), le tabelle dei limiti
-- contano solo quanti controlli. Tutto si legge e si scrive dal server con
-- la chiave di servizio, tranne i propri contatori del giorno.

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('scudo-dati', true, 'free', 'Scudo Dati – controllo se la tua email è finita in una fuga di dati e se una password è già circolata')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('scudo-dati', 'Scudo Dati', 1, 10)
on conflict (key) do nothing;

-- Costo in KU Karma del controllo di un'altra email e tetto giornaliero di
-- chiamate al servizio esterno (per tutto il sito)
insert into public.system_settings (key, value) values
  ('scudo_dati_other_cost', '3'),
  ('scudo_dati_daily_cap', '90')
on conflict (key) do nothing;

-- Esiti recenti per impronta dell'email (validi 24 ore)
create table if not exists public.scudo_dati_cache (
  email_hash text primary key,
  result jsonb not null,
  checked_at timestamptz not null default now()
);
alter table public.scudo_dati_cache enable row level security;
revoke all on public.scudo_dati_cache from anon, authenticated;

-- Chiamate al servizio esterno per giorno (tetto di sicurezza)
create table if not exists public.scudo_dati_calls (
  day date primary key,
  calls integer not null default 0
);
alter table public.scudo_dati_calls enable row level security;
revoke all on public.scudo_dati_calls from anon, authenticated;

-- Controlli fatti oggi da ciascuno: propria email (solo quelli nuovi, non
-- già in cache) e altre email
create table if not exists public.scudo_dati_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  own_checks integer not null default 0,
  other_checks integer not null default 0,
  primary key (user_id, day)
);
alter table public.scudo_dati_usage enable row level security;
drop policy if exists scudo_dati_usage_own on public.scudo_dati_usage;
create policy scudo_dati_usage_own on public.scudo_dati_usage for select to authenticated using (user_id = (select auth.uid()));

-- Prenota un controllo dell'utente collegato: servizio incluso nel piano e
-- limite del giorno (propria email 5, altre email 10). p_kind: 'own' | 'other'
create or replace function public.scudo_dati_reserve(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_limit int := case p_kind when 'own' then 5 when 'other' then 10 else 0 end;
  v_used int;
begin
  if v_uid is null or v_limit = 0 or not exists (select 1 from public.tool_access(v_uid, 'scudo-dati') t where t.allowed) then
    return jsonb_build_object('result', 'not_allowed');
  end if;

  insert into public.scudo_dati_usage (user_id, day) values (v_uid, v_today)
  on conflict (user_id, day) do nothing;

  select case p_kind when 'own' then own_checks else other_checks end into v_used
  from public.scudo_dati_usage
  where user_id = v_uid and day = v_today
  for update;

  if v_used >= v_limit then
    return jsonb_build_object('result', 'user_limit', 'left_today', 0);
  end if;

  update public.scudo_dati_usage
  set own_checks = own_checks + case when p_kind = 'own' then 1 else 0 end,
      other_checks = other_checks + case when p_kind = 'other' then 1 else 0 end
  where user_id = v_uid and day = v_today;

  return jsonb_build_object('result', 'ok', 'left_today', v_limit - v_used - 1);
end;
$$;
revoke all on function public.scudo_dati_reserve(text) from public, anon;
grant execute on function public.scudo_dati_reserve(text) to authenticated;

-- Restituisce un controllo prenotato se il servizio esterno non ha risposto
create or replace function public.scudo_dati_release(p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  if auth.uid() is null then
    return;
  end if;
  update public.scudo_dati_usage
  set own_checks = greatest(own_checks - case when p_kind = 'own' then 1 else 0 end, 0),
      other_checks = greatest(other_checks - case when p_kind = 'other' then 1 else 0 end, 0)
  where user_id = auth.uid() and day = v_today;
end;
$$;
revoke all on function public.scudo_dati_release(text) from public, anon;
grant execute on function public.scudo_dati_release(text) to authenticated;

-- Conta una chiamata al servizio esterno se il tetto del giorno lo consente
-- (solo dal server con la chiave di servizio)
create or replace function public.scudo_dati_take_call()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_cap int := greatest(public.setting_int('scudo_dati_daily_cap', 90), 0);
  v_calls int;
begin
  insert into public.scudo_dati_calls (day, calls) values (v_today, 1)
  on conflict (day) do update set calls = public.scudo_dati_calls.calls + 1
  where public.scudo_dati_calls.calls < v_cap
  returning calls into v_calls;
  return v_calls is not null and v_calls <= v_cap;
end;
$$;
revoke all on function public.scudo_dati_take_call() from public, anon, authenticated;
grant execute on function public.scudo_dati_take_call() to service_role;

-- KU Karma: stessa funzione di prima con 'scudo-dati' aggiunto all'elenco
create or replace function public.award_tool_point(p_tool_name text)
 returns table(awarded boolean, new_balance integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_rows int;
  v_balance int;
  v_ku int;
begin
  if auth.uid() is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail', 'oxygen',
    'documento-sicuro', 'verifica-iban', 'firma-email', 'calcolatrici', 'focus',
    'landing-page', 'garage', 'mandala', 'scudo-dati'
  ) then
    return;
  end if;

  if not exists (select 1 from public.tool_access(auth.uid(), p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (auth.uid(), p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  v_ku := public.ku_points_for(p_tool_name);
  if v_rows = 0 or v_ku = 0 then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + v_ku,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
  where id = auth.uid()
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;
