-- KUMANI CRONOBIOMA (piano Plus): l'orologio interno. Il questionario
-- pubblico non salva niente; qui il profilo (risposte e orari scelti) e il
-- diario del sonno. Dati sul sonno = dati sulla salute (GDPR art. 9): si
-- salvano solo con il consenso esplicito, visibili solo a chi li scrive.
-- Spento finché lo Staff non lo accende.

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('cronobioma', false, 'base', 'KUMANI CRONOBIOMA – il tuo orologio interno: cronotipo, giornata ideale, diario del sonno, turni e fuso orario')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('cronobioma', 'KUMANI CRONOBIOMA', 1, 10)
on conflict (key) do nothing;

create table if not exists public.cronobioma_profiles (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 2048),
  wake_time text not null check (wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  sleep_need integer not null default 480 check (sleep_need between 360 and 600),
  health_consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cronobioma_sleep_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  night date not null,
  bed text not null check (bed ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  wake text not null check (wake ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quality smallint not null check (quality between 1 and 3),
  created_at timestamptz not null default now(),
  unique (owner_id, night)
);
create index if not exists cronobioma_sleep_logs_owner on public.cronobioma_sleep_logs(owner_id, night desc);

-- Il proprietario non cambia; massimo 800 notti nel diario (più di due anni)
create or replace function public.cronobioma_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and tg_table_name = 'cronobioma_sleep_logs' then
    if (select count(*) from public.cronobioma_sleep_logs where owner_id = new.owner_id) >= 800 then
      raise exception 'cronobioma_limit';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;
    if tg_table_name = 'cronobioma_profiles' then
      new.created_at := old.created_at;
      new.updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists cronobioma_profiles_guard on public.cronobioma_profiles;
create trigger cronobioma_profiles_guard before update on public.cronobioma_profiles
  for each row execute function public.cronobioma_guard();
drop trigger if exists cronobioma_logs_guard on public.cronobioma_sleep_logs;
create trigger cronobioma_logs_guard before insert or update on public.cronobioma_sleep_logs
  for each row execute function public.cronobioma_guard();

-- Solo chi li ha scritti; per scrivere serve il piano (Plus). Cancellare si
-- può sempre, anche senza piano.
alter table public.cronobioma_profiles enable row level security;
alter table public.cronobioma_sleep_logs enable row level security;
revoke all on public.cronobioma_profiles from anon, authenticated;
revoke all on public.cronobioma_sleep_logs from anon, authenticated;
grant select, insert, update, delete on public.cronobioma_profiles to authenticated;
grant select, insert, update, delete on public.cronobioma_sleep_logs to authenticated;

drop policy if exists cronobioma_profiles_select on public.cronobioma_profiles;
create policy cronobioma_profiles_select on public.cronobioma_profiles for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists cronobioma_profiles_insert on public.cronobioma_profiles;
create policy cronobioma_profiles_insert on public.cronobioma_profiles for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.can_use_tool('cronobioma') t where t.allowed));
drop policy if exists cronobioma_profiles_update on public.cronobioma_profiles;
create policy cronobioma_profiles_update on public.cronobioma_profiles for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.can_use_tool('cronobioma') t where t.allowed));
drop policy if exists cronobioma_profiles_delete on public.cronobioma_profiles;
create policy cronobioma_profiles_delete on public.cronobioma_profiles for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists cronobioma_logs_select on public.cronobioma_sleep_logs;
create policy cronobioma_logs_select on public.cronobioma_sleep_logs for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists cronobioma_logs_insert on public.cronobioma_sleep_logs;
create policy cronobioma_logs_insert on public.cronobioma_sleep_logs for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.can_use_tool('cronobioma') t where t.allowed));
drop policy if exists cronobioma_logs_update on public.cronobioma_sleep_logs;
create policy cronobioma_logs_update on public.cronobioma_sleep_logs for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.can_use_tool('cronobioma') t where t.allowed));
drop policy if exists cronobioma_logs_delete on public.cronobioma_sleep_logs;
create policy cronobioma_logs_delete on public.cronobioma_sleep_logs for delete to authenticated using (owner_id = (select auth.uid()));

-- KU Karma del giorno anche per CRONOBIOMA (il diario del mattino)
CREATE OR REPLACE FUNCTION public.award_tool_point_for(p_user uuid, p_tool_name text)
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
  if p_user is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail', 'oxygen',
    'documento-sicuro', 'verifica-iban', 'firma-email', 'calcolatrici', 'focus',
    'landing-page', 'garage', 'mandala', 'scudo-dati', 'casa', 'nexus', 'clienti', 'hopla', 'firma-pdf', 'convivium', 'lumen', 'vox', 'captio', 'diarium', 'imago', 'forma', 'tutela', 'cronobioma'
  ) then
    return;
  end if;

  if not exists (select 1 from public.tool_access(p_user, p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (p_user, p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  v_ku := public.ku_points_for(p_tool_name);
  if v_rows = 0 or v_ku = 0 then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + v_ku,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
  where id = p_user
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;
