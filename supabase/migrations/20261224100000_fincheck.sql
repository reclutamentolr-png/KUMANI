-- FinCheck: test di educazione finanziaria (gratuito) + check-up del
-- bilancio dai dati di Spendly (piano Base, calcolato nella pagina).
-- Qui: i risultati del test (privati: li vede solo la persona), gli
-- obiettivi spuntati e i KU Karma per il test (la prima volta e poi al
-- massimo una volta ogni 90 giorni).

insert into public.marketplace_settings (tool_name, is_enabled, description, required_plan)
values ('fincheck', true, 'FinCheck – test di educazione finanziaria e check-up del bilancio. Spento: il servizio non è disponibile', 'free')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('fincheck', 'FinCheck: test completato (la prima volta, poi ogni 3 mesi)', 5, 20)
on conflict (key) do nothing;

create table if not exists public.fincheck_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers smallint[] not null check (array_length(answers, 1) = 15),
  area_scores smallint[] not null check (array_length(area_scores, 1) = 5),
  total smallint not null check (total between 0 and 45),
  ku_awarded integer not null default 0,
  goals_done text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_fincheck_results_user on public.fincheck_results(user_id, created_at desc);

alter table public.fincheck_results enable row level security;
revoke all on public.fincheck_results from anon, authenticated;
grant select on public.fincheck_results to authenticated;
grant update (goals_done) on public.fincheck_results to authenticated;

drop policy if exists fincheck_results_select_own on public.fincheck_results;
create policy fincheck_results_select_own on public.fincheck_results
  for select to authenticated using (user_id = auth.uid());

drop policy if exists fincheck_results_update_own on public.fincheck_results;
create policy fincheck_results_update_own on public.fincheck_results
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Salva un test (risposte già in punti, 0-3) e assegna i KU Karma se
-- spettano. I punteggi per area si ricalcolano qui: 3 domande per area.
create or replace function public.fincheck_save(p_answers smallint[])
returns table (result_id uuid, total integer, ku_awarded integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_areas smallint[] := '{}';
  v_total int := 0;
  v_ku int := 0;
  v_id uuid;
  i int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_answers is null or array_length(p_answers, 1) <> 15 then
    raise exception 'invalid_answers';
  end if;
  for i in 1..15 loop
    if p_answers[i] is null or p_answers[i] < 0 or p_answers[i] > 3 then
      raise exception 'invalid_answers';
    end if;
  end loop;
  for i in 0..4 loop
    v_areas := v_areas || (p_answers[i * 3 + 1] + p_answers[i * 3 + 2] + p_answers[i * 3 + 3])::smallint;
    v_total := v_total + p_answers[i * 3 + 1] + p_answers[i * 3 + 2] + p_answers[i * 3 + 3];
  end loop;

  -- Un test salvato a persona ogni 10 secondi al massimo (niente raffiche)
  if exists (select 1 from public.fincheck_results where user_id = v_uid and created_at > now() - interval '10 seconds') then
    raise exception 'too_fast';
  end if;

  -- KU Karma: primo test, poi solo se l'ultimo premiato ha almeno 90 giorni
  if exists (select 1 from public.tool_access(v_uid, 'fincheck') t where t.allowed)
     and not exists (
       select 1 from public.fincheck_results
       where user_id = v_uid and ku_awarded > 0 and created_at > now() - interval '90 days'
     ) then
    v_ku := public.ku_points_for('fincheck');
  end if;

  insert into public.fincheck_results (user_id, answers, area_scores, total, ku_awarded)
  values (v_uid, p_answers, v_areas, v_total, v_ku)
  returning id into v_id;

  if v_ku > 0 then
    update public.profiles
    set daily_points = coalesce(daily_points, 0) + v_ku,
        ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
    where id = v_uid;
  end if;

  return query select v_id, v_total, v_ku;
end;
$$;

revoke all on function public.fincheck_save(smallint[]) from public, anon;
grant execute on function public.fincheck_save(smallint[]) to authenticated;
