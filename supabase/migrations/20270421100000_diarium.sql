-- KUMANI DIARIUM (piano Pro): calendario dei post. L'AI prepara 30 giorni di
-- idee (giorno, social, formato, idea, frase d'apertura); i post compaiono
-- nell'Agenda e si segnano «fatto». Visibili solo a chi li ha creati.
insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('diarium', false, 'pro', 'KUMANI DIARIUM – calendario dei post: 30 giorni di idee per i social')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('diarium', 'KUMANI DIARIUM', 1, 10)
on conflict (key) do nothing;

insert into public.system_settings (key, value)
values ('calendar_ai_daily_runs', '3')
on conflict (key) do nothing;

create table if not exists public.diarium_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  start_date date not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists diarium_plans_owner on public.diarium_plans(owner_id, created_at desc);

create table if not exists public.diarium_posts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diarium_plans(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  post_date date not null,
  network text not null check (network in ('instagram', 'facebook', 'tiktok', 'linkedin')),
  format text not null check (format in ('post', 'reel', 'story', 'carousel')),
  title text not null check (char_length(title) between 1 and 120),
  idea text not null default '' check (char_length(idea) <= 1000),
  hook text not null default '' check (char_length(hook) <= 300),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists diarium_posts_plan on public.diarium_posts(plan_id, post_date);
create index if not exists diarium_posts_owner_date on public.diarium_posts(owner_id, post_date);

-- Massimo 12 piani per utente (i più vecchi si cancellano a mano)
create or replace function public.diarium_plans_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.diarium_plans where owner_id = new.owner_id) >= 12 then
    raise exception 'diarium_limit';
  end if;
  return new;
end;
$$;
drop trigger if exists diarium_plans_guard on public.diarium_plans;
create trigger diarium_plans_guard before insert on public.diarium_plans
  for each row execute function public.diarium_plans_guard();

-- Dei post si cambia solo «fatto» (il resto lo scrive l'AI alla creazione)
create or replace function public.diarium_posts_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.id := old.id; new.plan_id := old.plan_id; new.owner_id := old.owner_id;
  new.post_date := old.post_date; new.network := old.network; new.format := old.format;
  new.title := old.title; new.idea := old.idea; new.hook := old.hook; new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists diarium_posts_guard on public.diarium_posts;
create trigger diarium_posts_guard before update on public.diarium_posts
  for each row execute function public.diarium_posts_guard();

alter table public.diarium_plans enable row level security;
alter table public.diarium_posts enable row level security;
revoke all on public.diarium_plans from anon, authenticated;
revoke all on public.diarium_posts from anon, authenticated;
grant select, insert, delete on public.diarium_plans to authenticated;
grant select, insert, update, delete on public.diarium_posts to authenticated;

drop policy if exists diarium_plans_select on public.diarium_plans;
create policy diarium_plans_select on public.diarium_plans for select to authenticated using (owner_id = auth.uid());
drop policy if exists diarium_plans_insert on public.diarium_plans;
create policy diarium_plans_insert on public.diarium_plans for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.can_use_tool('diarium') t where t.allowed));
drop policy if exists diarium_plans_delete on public.diarium_plans;
create policy diarium_plans_delete on public.diarium_plans for delete to authenticated using (owner_id = auth.uid());

drop policy if exists diarium_posts_select on public.diarium_posts;
create policy diarium_posts_select on public.diarium_posts for select to authenticated using (owner_id = auth.uid());
drop policy if exists diarium_posts_insert on public.diarium_posts;
create policy diarium_posts_insert on public.diarium_posts for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.diarium_plans p where p.id = plan_id and p.owner_id = auth.uid()));
drop policy if exists diarium_posts_update on public.diarium_posts;
create policy diarium_posts_update on public.diarium_posts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists diarium_posts_delete on public.diarium_posts;
create policy diarium_posts_delete on public.diarium_posts for delete to authenticated using (owner_id = auth.uid());

-- KU Karma del giorno anche per DIARIUM
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
    'landing-page', 'garage', 'mandala', 'scudo-dati', 'casa', 'nexus', 'clienti', 'hopla', 'firma-pdf', 'convivium', 'lumen', 'vox', 'captio', 'diarium'
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
$function$
;
