-- Ecosistema, collegamento n. 7: «Il tuo benessere di oggi».
--
-- Tre passi al giorno tra i servizi di benessere: respiro (Oxygen),
-- concentrazione (Focus) e Mandala oppure NeuroBalance. Fatti tutti e tre,
-- si ritira un bonus di KU Karma (una volta al giorno, valore in Gestione KU:
-- 'wellness_path'). I giorni completati restano in wellness_path_days per la
-- serie di giorni consecutivi (daily_tool_points si cancella dopo 30 giorni).
-- Mandala ora dà anche il suo KU Karma quando si salva un disegno.

insert into public.ku_activity_points (key, label, points, sort_order) values
  ('mandala', 'Mandala', 1, 10),
  ('wellness_path', 'Benessere di oggi (bonus dei 3 passi)', 3, 5)
on conflict (key) do nothing;

create table if not exists public.wellness_path_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  ku_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.wellness_path_days enable row level security;
drop policy if exists wellness_path_days_own on public.wellness_path_days;
create policy wellness_path_days_own on public.wellness_path_days for select to authenticated using (user_id = (select auth.uid()));

-- KU Karma: stessa funzione di prima con 'mandala' aggiunto all'elenco
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
    'landing-page', 'garage', 'mandala'
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

-- Stato di oggi: {breath, focus, mind, claimed, bonus, streak}
create or replace function public.wellness_path_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_streak int := 0;
  v_day date;
begin
  if auth.uid() is null then
    return null;
  end if;
  -- Giorni consecutivi completati, fino a oggi (o fino a ieri se oggi manca ancora)
  v_day := case when exists (select 1 from public.wellness_path_days where user_id = auth.uid() and day = v_today) then v_today else v_today - 1 end;
  while exists (select 1 from public.wellness_path_days where user_id = auth.uid() and day = v_day) loop
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;
  return jsonb_build_object(
    'breath', exists (select 1 from public.daily_tool_points where user_id = auth.uid() and awarded_on = v_today and tool_name = 'oxygen'),
    'focus', exists (select 1 from public.daily_tool_points where user_id = auth.uid() and awarded_on = v_today and tool_name = 'focus'),
    'mind', exists (select 1 from public.daily_tool_points where user_id = auth.uid() and awarded_on = v_today and tool_name in ('mandala', 'neurobalance')),
    'claimed', exists (select 1 from public.wellness_path_days where user_id = auth.uid() and day = v_today),
    'bonus', public.ku_points_for('wellness_path'),
    'streak', v_streak
  );
end;
$$;
revoke all on function public.wellness_path_today() from public, anon;
grant execute on function public.wellness_path_today() to authenticated;

-- Ritira il bonus: solo con i tre passi fatti oggi, una volta al giorno
create or replace function public.claim_wellness_path_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_state jsonb := public.wellness_path_today();
  v_ku int := public.ku_points_for('wellness_path');
  v_rows int;
begin
  if v_state is null then
    return jsonb_build_object('error', 'login');
  end if;
  if not ((v_state ->> 'breath')::boolean and (v_state ->> 'focus')::boolean and (v_state ->> 'mind')::boolean) then
    return jsonb_build_object('error', 'incomplete');
  end if;
  insert into public.wellness_path_days (user_id, day, ku_awarded) values (auth.uid(), v_today, v_ku)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('error', 'already');
  end if;
  if v_ku > 0 then
    update public.profiles
    set daily_points = coalesce(daily_points, 0) + v_ku,
        ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
    where id = auth.uid();
  end if;
  return public.wellness_path_today() || jsonb_build_object('awarded', v_ku);
end;
$$;
revoke all on function public.claim_wellness_path_bonus() from public, anon;
grant execute on function public.claim_wellness_path_bonus() to authenticated;
