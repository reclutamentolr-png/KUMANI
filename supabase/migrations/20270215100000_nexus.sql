-- KUMANI NEXUS (SVAGO, gratis) — fase 1: il cruciverba del giorno.
-- La griglia si costruisce dal server a partire dalla data (uguale per tutti,
-- non si salva); qui restano solo i risultati, per i giorni di fila.

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('nexus', true, 'free', 'KUMANI NEXUS – il cruciverba del giorno')
on conflict (tool_name) do nothing;

create table if not exists public.nexus_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  locale text not null check (locale in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru')),
  seconds integer not null check (seconds between 0 and 86400),
  hints smallint not null default 0 check (hints between 0 and 49),
  completed_at timestamptz not null default now(),
  primary key (user_id, day, locale)
);
create index if not exists idx_nexus_results_user_day on public.nexus_results(user_id, day desc);

alter table public.nexus_results enable row level security;

-- Ognuno vede i propri risultati; il salvataggio passa dal server, che
-- controlla prima la griglia completata.
drop policy if exists "nexus_results_select_own" on public.nexus_results;
create policy "nexus_results_select_own" on public.nexus_results for select to authenticated using (user_id = auth.uid());

-- KU Karma per il primo cruciverba completato del giorno (come gli altri servizi)
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
    'landing-page', 'garage', 'mandala', 'scudo-dati', 'casa', 'nexus'
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
