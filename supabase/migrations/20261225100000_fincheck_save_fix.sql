-- FinCheck: correzione di fincheck_save(). I nomi restituiti (total,
-- ku_awarded) coincidevano con le colonne di fincheck_results e il
-- controllo dei KU Karma falliva ("column reference is ambiguous"):
-- nessun test veniva salvato. Ora le colonne hanno sempre il nome della
-- tabella davanti.

create or replace function public.fincheck_save(p_answers smallint[])
returns table (result_id uuid, total integer, ku_awarded integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
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
  if exists (select 1 from public.fincheck_results fr where fr.user_id = v_uid and fr.created_at > now() - interval '10 seconds') then
    raise exception 'too_fast';
  end if;

  -- KU Karma: primo test, poi solo se l'ultimo premiato ha almeno 90 giorni
  if exists (select 1 from public.tool_access(v_uid, 'fincheck') t where t.allowed)
     and not exists (
       select 1 from public.fincheck_results fr
       where fr.user_id = v_uid and fr.ku_awarded > 0 and fr.created_at > now() - interval '90 days'
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
