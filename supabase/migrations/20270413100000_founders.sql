-- «Kumani Fondatori» (21/10/2026): i primi 50 nuovi iscritti che usano almeno
-- un servizio ricevono in regalo un anno di Base (voucher dall'account
-- KUMANI, prize_key 'founder') e il segno «Fondatore». Gli iscritti di prima
-- della promozione sono Fondatori ma non contano nei 50 (counted = false).

create table if not exists public.founder_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  number int,              -- posto nei 50 (null per chi non conta)
  counted boolean not null default true,
  voucher_code text,
  created_at timestamptz not null default now()
);
create unique index if not exists founder_members_number_idx on public.founder_members (number) where number is not null;
alter table public.founder_members enable row level security;
-- Lettura pubblica solo del fatto «è Fondatore» (segno sul profilo)
drop policy if exists founder_members_read on public.founder_members;
create policy founder_members_read on public.founder_members for select using (true);

-- Impostazioni: accesa/spenta, quanti posti, da quando
insert into public.system_settings (key, value) values
  ('founders_enabled', 'true'),
  ('founders_limit', '50'),
  ('founders_since', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
on conflict (key) do nothing;

-- Un posto tra i Fondatori, in modo atomico (niente 51°). Solo dal server.
create or replace function public.claim_founder_slot(p_user uuid)
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_limit int := public.setting_int('founders_limit', 50);
  v_since timestamptz;
  v_next int;
begin
  if public.setting_text('founders_enabled') is distinct from 'true' then
    return null;
  end if;
  begin
    v_since := public.setting_text('founders_since')::timestamptz;
  exception when others then
    return null;
  end;
  lock table public.founder_members in share row exclusive mode;
  if exists (select 1 from public.founder_members where user_id = p_user) then
    return null;
  end if;
  -- Persona vera e nuova: iscritta dopo l'inizio, non ospite né bloccata,
  -- non Staff né account KUMANI, e ha usato almeno un servizio
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user and p.created_at >= v_since and p.guest_until is null and not coalesce(p.is_blocked, false)
      and not public.admin_is_staff(p.id) and p.id::text is distinct from public.setting_text('house_account_id')
  ) or not exists (select 1 from public.tool_opens t where t.user_id = p_user) then
    return null;
  end if;
  select coalesce(max(number), 0) + 1 into v_next from public.founder_members where counted;
  if v_next > v_limit then
    return null;
  end if;
  insert into public.founder_members (user_id, number, counted) values (p_user, v_next, true);
  return v_next;
end;
$function$;
revoke execute on function public.claim_founder_slot(uuid) from public, anon, authenticated;
