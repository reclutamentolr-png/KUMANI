-- «Come stai oggi?»: la faccina si può correggere solo nei primi 2 minuti
-- (per rimediare a un tocco sbagliato), poi resta fissa fino a domani;
-- l'appunto si può sempre cambiare. created_at = quando è stata scelta.

alter table public.wellness_moods add column if not exists created_at timestamptz;
update public.wellness_moods set created_at = updated_at where created_at is null;
alter table public.wellness_moods alter column created_at set default now();
alter table public.wellness_moods alter column created_at set not null;

create or replace function public.wellness_path_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_breath boolean;
  v_focus boolean;
  v_mind boolean;
  v_pause boolean;
  v_steps int;
  v_step_ku int := public.ku_points_for('wellness_step');
  v_awarded int;
  v_mood smallint;
  v_note text;
  v_mood_at timestamptz;
  v_grat_today int;
  v_counted boolean;
  v_streak int := 0;
  v_day date;
begin
  if v_uid is null then
    return null;
  end if;
  select
    bool_or(tool_name = 'oxygen'), bool_or(tool_name = 'focus'), bool_or(tool_name in ('mandala', 'neurobalance'))
  into v_breath, v_focus, v_mind
  from public.daily_tool_points where user_id = v_uid and awarded_on = v_today;
  v_pause := exists (select 1 from public.wellness_pauses where user_id = v_uid and day = v_today and finished_at is not null);
  v_steps := coalesce(v_breath, false)::int + coalesce(v_focus, false)::int + coalesce(v_mind, false)::int + v_pause::int;
  select coalesce(ku_awarded, 0) into v_awarded from public.wellness_path_days where user_id = v_uid and day = v_today;
  select mood, note, created_at into v_mood, v_note, v_mood_at from public.wellness_moods where user_id = v_uid and day = v_today;
  select count(*) into v_grat_today from public.wellness_gratitude where user_id = v_uid and day = v_today;
  v_counted := v_steps > 0 or v_mood is not null or v_grat_today > 0 or exists (select 1 from public.wellness_path_days where user_id = v_uid and day = v_today);

  -- Giorni di fila con almeno un passo, un umore o una cosa bella (fino a
  -- oggi, o fino a ieri se oggi non c'è ancora niente)
  v_day := case when v_counted then v_today else v_today - 1 end;
  loop
    exit when not (
      exists (select 1 from public.wellness_path_days where user_id = v_uid and day = v_day)
      or exists (select 1 from public.wellness_moods where user_id = v_uid and day = v_day)
      or exists (select 1 from public.wellness_gratitude where user_id = v_uid and day = v_day)
      or exists (select 1 from public.wellness_pauses where user_id = v_uid and day = v_day and finished_at is not null)
      or exists (select 1 from public.daily_tool_points where user_id = v_uid and awarded_on = v_day and tool_name in ('oxygen', 'focus', 'mandala', 'neurobalance'))
    );
    v_streak := v_streak + 1;
    v_day := v_day - 1;
    exit when v_streak >= 366;
  end loop;

  return jsonb_build_object(
    'breath', coalesce(v_breath, false),
    'focus', coalesce(v_focus, false),
    'mind', coalesce(v_mind, false),
    'pause', v_pause,
    'steps', v_steps,
    'step_ku', v_step_ku,
    'max_steps', 3,
    'awarded', coalesce(v_awarded, 0),
    'claimable', greatest(0, least(v_steps, 3) * v_step_ku - coalesce(v_awarded, 0)),
    'mood', v_mood,
    'mood_note', v_note,
    -- Fino a quando la faccina si può correggere (poi resta fissa fino a domani)
    'mood_lock_at', v_mood_at + interval '2 minutes',
    'week', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day::date, 'mood', m.mood) order by d.day), '[]'::jsonb)
      from generate_series(v_today - 6, v_today, interval '1 day') as d(day)
      left join public.wellness_moods m on m.user_id = v_uid and m.day = d.day::date
    ),
    'gratitude_today', v_grat_today,
    'gratitude_total', (select count(*) from public.wellness_gratitude where user_id = v_uid),
    'counted', v_counted,
    'streak', v_streak
  );
end;
$$;
revoke all on function public.wellness_path_today() from public, anon;
grant execute on function public.wellness_path_today() to authenticated;

create or replace function public.wellness_set_mood(p_mood int, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 280), '');
  v_row public.wellness_moods%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'login');
  end if;
  if p_mood is null or p_mood not between 1 and 5 then
    return jsonb_build_object('error', 'invalid');
  end if;
  select * into v_row from public.wellness_moods where user_id = v_uid and day = v_today for update;
  if not found then
    insert into public.wellness_moods (user_id, day, mood, note) values (v_uid, v_today, p_mood, v_note)
    on conflict (user_id, day) do nothing;
    return public.wellness_path_today();
  end if;
  -- Faccina diversa dopo i 2 minuti: resta quella di prima, si salva solo l'appunto
  if p_mood <> v_row.mood and v_row.created_at < now() - interval '2 minutes' then
    update public.wellness_moods set note = v_note, updated_at = now() where user_id = v_uid and day = v_today;
    return public.wellness_path_today() || jsonb_build_object('error', 'locked');
  end if;
  update public.wellness_moods set mood = p_mood, note = v_note, updated_at = now() where user_id = v_uid and day = v_today;
  return public.wellness_path_today();
end;
$$;
revoke all on function public.wellness_set_mood(int, text) from public, anon;
grant execute on function public.wellness_set_mood(int, text) to authenticated;
