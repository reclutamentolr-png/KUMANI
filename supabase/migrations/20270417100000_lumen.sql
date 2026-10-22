-- KUMANI LUMEN (piano Pro): teleprompter per Reel, TikTok, Shorts e video
-- aziendali. Il testo scorre sopra la fotocamera frontale; il video si
-- registra e si scarica nel telefono, senza passare dai server. Qui si
-- salvano solo i copioni, visibili a chi li ha scritti.

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('lumen', true, 'pro', 'KUMANI LUMEN – teleprompter: il copione scorre sullo schermo mentre registri')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('lumen', 'KUMANI LUMEN', 1, 10)
on conflict (key) do nothing;

create table if not exists public.lumen_scripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  body text not null default '' check (char_length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lumen_scripts_owner on public.lumen_scripts(owner_id, updated_at desc);

-- Il proprietario e la data di creazione non cambiano; massimo 200 copioni
create or replace function public.lumen_scripts_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.lumen_scripts where owner_id = new.owner_id) >= 200 then
      raise exception 'lumen_limit';
    end if;
    return new;
  end if;
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists lumen_scripts_guard on public.lumen_scripts;
create trigger lumen_scripts_guard before insert or update on public.lumen_scripts
  for each row execute function public.lumen_scripts_guard();

-- Solo chi li ha scritti; per crearne e modificarli serve il piano (Pro)
alter table public.lumen_scripts enable row level security;
revoke all on public.lumen_scripts from anon, authenticated;
grant select, insert, update, delete on public.lumen_scripts to authenticated;

drop policy if exists lumen_scripts_select on public.lumen_scripts;
create policy lumen_scripts_select on public.lumen_scripts for select to authenticated using (owner_id = auth.uid());
drop policy if exists lumen_scripts_insert on public.lumen_scripts;
create policy lumen_scripts_insert on public.lumen_scripts for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.can_use_tool('lumen') t where t.allowed));
drop policy if exists lumen_scripts_update on public.lumen_scripts;
create policy lumen_scripts_update on public.lumen_scripts for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.can_use_tool('lumen') t where t.allowed));
drop policy if exists lumen_scripts_delete on public.lumen_scripts;
create policy lumen_scripts_delete on public.lumen_scripts for delete to authenticated using (owner_id = auth.uid());

-- KU Karma del giorno anche per LUMEN
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
    'landing-page', 'garage', 'mandala', 'scudo-dati', 'casa', 'nexus', 'clienti', 'hopla', 'firma-pdf', 'convivium', 'lumen'
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
