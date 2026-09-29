-- Qualifiche raggiunte (Rising Star 6, Shining Star 36, Diamond Star 108
-- diretti attivi) con la data in cui sono state raggiunte, per il messaggio
-- "Obiettivo raggiunto in N giorni" nella pagina Rete.
--
-- La data si ricostruisce: è l'attivazione dell'N-esimo diretto attivo
-- (subscription_started_at, o l'iscrizione se manca). Una volta salvata
-- resta fissa, anche se poi qualche diretto disattiva l'abbonamento.
-- I giorni si contano dall'iscrizione del Kumano (profiles.created_at).

create table if not exists public.rank_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank_key text not null check (rank_key in ('rising_star', 'shining_star', 'diamond_star')),
  achieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, rank_key)
);

alter table public.rank_achievements enable row level security;

drop policy if exists rank_achievements_select_own on public.rank_achievements;
create policy rank_achievements_select_own on public.rank_achievements
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.rank_achievements from anon;
revoke insert, update, delete on public.rank_achievements from authenticated;

-- Registra le qualifiche appena raggiunte e restituisce tutte quelle del
-- Kumano che chiama, con i giorni dall'iscrizione.
create or replace function public.my_rank_achievements()
returns table (rank_key text, achieved_at timestamptz, days integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rank record;
  v_when timestamptz;
begin
  if v_uid is null then
    return;
  end if;

  for v_rank in
    select * from (values ('rising_star', 6), ('shining_star', 36), ('diamond_star', 108)) as r(key, threshold)
  loop
    if exists (select 1 from public.rank_achievements a where a.user_id = v_uid and a.rank_key = v_rank.key) then
      continue;
    end if;

    -- Attivazione dell'N-esimo diretto attivo (stessa regola "attivo" della
    -- pagina Rete: abbonamento 'active' e non scaduto)
    select d.started into v_when
    from (
      select coalesce(s.subscription_started_at, s.created_at) as started
      from public.profiles s
      where s.sponsor_id = v_uid
        and s.subscription_status = 'active'
        and (s.subscription_expires_at is null or s.subscription_expires_at > now())
      order by 1
      offset v_rank.threshold - 1
      limit 1
    ) d;

    if v_when is not null then
      insert into public.rank_achievements (user_id, rank_key, achieved_at)
      values (v_uid, v_rank.key, least(v_when, now()))
      on conflict do nothing;
    end if;
  end loop;

  return query
  select a.rank_key, a.achieved_at,
         greatest(0, (a.achieved_at::date - p.created_at::date))::int
  from public.rank_achievements a
  join public.profiles p on p.id = a.user_id
  where a.user_id = v_uid;
end;
$$;

revoke all on function public.my_rank_achievements() from public, anon;
grant execute on function public.my_rank_achievements() to authenticated;
