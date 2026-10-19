-- «Il tuo momento di benessere» (dashboard), al posto dei tre passi
-- obbligatori: basta un passo al giorno.
--
-- Passi verificati (fatti davvero dentro KUMANI), +1 KU Karma ciascuno fino a
-- 3 (valore in Gestione KU: 'wellness_step'):
--   respiro (Oxygen), concentrazione (Focus), mente (Mandala o NeuroBalance)
--   e la nuova «Pausa di un minuto» (stretching o occhi 20-20-20), con l'inizio
--   e la fine registrati qui: vale solo se è durata almeno 55 secondi.
-- Senza KU Karma (non si possono verificare), ma la giornata conta per la
-- serie: «Come stai oggi?» (umore da 1 a 5 con un appunto facoltativo) e
-- «Una cosa bella di oggi» (gratitudine, fino a 3 al giorno, nel barattolo).
-- Tutto privato: lo vede solo chi lo scrive.

-- KU Karma per passo al posto del bonus unico dei tre passi
delete from public.ku_activity_points where key = 'wellness_path';
insert into public.ku_activity_points (key, label, points, sort_order) values
  ('wellness_step', 'Momento di benessere (per ogni passo, fino a 3 al giorno)', 1, 5)
on conflict (key) do nothing;

-- Umore del giorno (uno al giorno, si può cambiare)
create table if not exists public.wellness_moods (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  mood smallint not null check (mood between 1 and 5),
  note text check (char_length(note) <= 280),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.wellness_moods enable row level security;
drop policy if exists wellness_moods_own on public.wellness_moods;
create policy wellness_moods_own on public.wellness_moods for select to authenticated using (user_id = (select auth.uid()));

-- Il barattolo delle cose belle
create table if not exists public.wellness_gratitude (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists wellness_gratitude_user on public.wellness_gratitude (user_id, created_at desc);
alter table public.wellness_gratitude enable row level security;
drop policy if exists wellness_gratitude_own on public.wellness_gratitude;
create policy wellness_gratitude_own on public.wellness_gratitude for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists wellness_gratitude_delete_own on public.wellness_gratitude;
create policy wellness_gratitude_delete_own on public.wellness_gratitude for delete to authenticated using (user_id = (select auth.uid()));

-- Pause di un minuto (inizio e fine registrati qui; si tengono 30 giorni)
create table if not exists public.wellness_pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('stretch', 'eyes')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists wellness_pauses_user_day on public.wellness_pauses (user_id, day);
alter table public.wellness_pauses enable row level security;

-- Giorni del benessere (serie): una riga anche senza KU Karma
comment on table public.wellness_path_days is 'Giorni del momento di benessere: ku_awarded = KU Karma dati quel giorno per i passi';

-- Stato di oggi
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
  select mood, note into v_mood, v_note from public.wellness_moods where user_id = v_uid and day = v_today;
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

-- Ritira i KU Karma dei passi fatti (anche più volte al giorno, man mano che
-- si fanno altri passi), fino a 3 passi
create or replace function public.claim_wellness_path_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_state jsonb := public.wellness_path_today();
  v_target int;
  v_before int;
  v_given int;
begin
  if v_state is null then
    return jsonb_build_object('error', 'login');
  end if;
  v_target := least((v_state ->> 'steps')::int, 3) * public.ku_points_for('wellness_step');
  if v_target <= 0 then
    return v_state || jsonb_build_object('error', 'incomplete');
  end if;
  insert into public.wellness_path_days (user_id, day, ku_awarded) values (v_uid, v_today, 0)
  on conflict do nothing;
  -- Riga bloccata: due richieste insieme non danno due volte gli stessi punti
  select ku_awarded into v_before from public.wellness_path_days where user_id = v_uid and day = v_today for update;
  v_given := v_target - coalesce(v_before, 0);
  if v_given <= 0 then
    return public.wellness_path_today() || jsonb_build_object('error', 'already');
  end if;
  update public.wellness_path_days set ku_awarded = v_target where user_id = v_uid and day = v_today;
  update public.profiles
  set daily_points = coalesce(daily_points, 0) + v_given,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_given
  where id = v_uid;
  return public.wellness_path_today() || jsonb_build_object('given', v_given);
end;
$$;
revoke all on function public.claim_wellness_path_bonus() from public, anon;
grant execute on function public.claim_wellness_path_bonus() to authenticated;

-- «Come stai oggi?»: umore da 1 a 5 e appunto facoltativo (si può cambiare)
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
begin
  if v_uid is null then
    return jsonb_build_object('error', 'login');
  end if;
  if p_mood is null or p_mood not between 1 and 5 then
    return jsonb_build_object('error', 'invalid');
  end if;
  insert into public.wellness_moods (user_id, day, mood, note) values (v_uid, v_today, p_mood, v_note)
  on conflict (user_id, day) do update set mood = excluded.mood, note = excluded.note, updated_at = now();
  return public.wellness_path_today();
end;
$$;
revoke all on function public.wellness_set_mood(int, text) from public, anon;
grant execute on function public.wellness_set_mood(int, text) to authenticated;

-- «Una cosa bella di oggi»: fino a 3 al giorno nel barattolo
create or replace function public.wellness_add_gratitude(p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_body text := left(btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g')), 200);
begin
  if v_uid is null then
    return jsonb_build_object('error', 'login');
  end if;
  if v_body = '' then
    return jsonb_build_object('error', 'invalid');
  end if;
  -- Un blocco per persona: tre richieste insieme non superano il limite
  perform pg_advisory_xact_lock(hashtext('wellness_gratitude:' || v_uid::text));
  if (select count(*) from public.wellness_gratitude where user_id = v_uid and day = v_today) >= 3 then
    return public.wellness_path_today() || jsonb_build_object('error', 'limit');
  end if;
  insert into public.wellness_gratitude (user_id, day, body) values (v_uid, v_today, v_body);
  return public.wellness_path_today();
end;
$$;
revoke all on function public.wellness_add_gratitude(text) from public, anon;
grant execute on function public.wellness_add_gratitude(text) to authenticated;

-- Pausa di un minuto: inizio (restituisce il codice della pausa) e fine (vale
-- solo dopo almeno 55 secondi e al massimo entro un'ora)
create or replace function public.wellness_pause_start(p_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or p_kind not in ('stretch', 'eyes') then
    return null;
  end if;
  -- Pulizia ogni tanto: le pause più vecchie di 30 giorni non servono
  if random() < 0.05 then
    delete from public.wellness_pauses where started_at < now() - interval '30 days';
  end if;
  -- Al massimo 20 pause iniziate al giorno
  if (select count(*) from public.wellness_pauses where user_id = v_uid and day = (now() at time zone 'Europe/Rome')::date) >= 20 then
    return null;
  end if;
  insert into public.wellness_pauses (user_id, day, kind) values (v_uid, (now() at time zone 'Europe/Rome')::date, p_kind)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.wellness_pause_start(text) from public, anon;
grant execute on function public.wellness_pause_start(text) to authenticated;

create or replace function public.wellness_pause_finish(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('error', 'login');
  end if;
  update public.wellness_pauses
  set finished_at = now()
  where id = p_id and user_id = v_uid and finished_at is null
    and started_at <= now() - interval '55 seconds'
    and started_at > now() - interval '1 hour';
  if not found then
    return public.wellness_path_today() || jsonb_build_object('error', 'too_soon');
  end if;
  return public.wellness_path_today();
end;
$$;
revoke all on function public.wellness_pause_finish(uuid) from public, anon;
grant execute on function public.wellness_pause_finish(uuid) to authenticated;
