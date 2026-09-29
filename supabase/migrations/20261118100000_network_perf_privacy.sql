-- Rete: classifica veloce, matrice non più leggibile da tutti, giorni degli
-- obiettivi nell'ora italiana. Da eseguire DOPO il deploy del codice che
-- legge i conteggi dell'Admin dal server (adminOverviewCounts).

-- 1. Indici della matrice (percorsi e utenti)
create index if not exists idx_matrix_nodes_path_gist on public.matrix_nodes using gist (path);
create index if not exists idx_matrix_nodes_path on public.matrix_nodes (path);
create index if not exists idx_matrix_nodes_user_id on public.matrix_nodes (user_id);
create index if not exists idx_profiles_sponsor_id on public.profiles (sponsor_id);

-- 2. Classifica calcolata in un solo passaggio (prima ogni Kumano
-- riscansionava tutti gli altri: lenta con migliaia di iscritti).
-- Stesse regole di 20261115100000_leaderboard_exclude_root.sql.
create or replace function public.get_network_leaderboard(p_limit integer default 100)
returns table (
  rank_position integer,
  first_name text,
  masked_code text,
  direct_active_count integer,
  network_active_count integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with members as (
    select p.id, p.first_name, p.referral_code, p.sponsor_id,
           (p.subscription_status = 'active'
             and (p.subscription_expires_at is null or p.subscription_expires_at > now())) as active
    from public.profiles p
    where not coalesce(p.is_blocked, false)
      and p.deleted_at is null
      -- Account padre generale: non compare in classifica
      and p.referral_code is distinct from 'IT-10000-Q'
      and not exists (
        select 1 from public.matrix_nodes top
        where top.user_id = p.id and top.parent_id is null
      )
  ),
  -- Invitati diretti attivi per sponsor
  direct as (
    select m.sponsor_id as id, count(*)::int as n
    from members m
    where m.active and m.sponsor_id is not null
    group by m.sponsor_id
  ),
  -- Ogni nodo attivo conta una volta per ciascuno dei suoi antenati
  ancestors as (
    select subpath(n.path, 0, i) as anc_path
    from public.matrix_nodes n
    join members m on m.id = n.user_id and m.active
    cross join lateral generate_series(1, nlevel(n.path) - 1) as i
  ),
  network as (
    select anc_path, count(*)::int as n from ancestors group by anc_path
  ),
  stats as (
    select m.id, m.first_name, m.referral_code,
           coalesce(d.n, 0) as direct_active,
           coalesce(nw.n, 0) as network_active
    from members m
    left join direct d on d.id = m.id
    left join public.matrix_nodes mine on mine.user_id = m.id
    left join network nw on nw.anc_path = mine.path
  ),
  ranked as (
    select s.*,
      row_number() over (
        order by s.network_active desc, s.direct_active desc, coalesce(s.first_name, '') asc, s.id
      )::int as pos
    from stats s
  )
  select
    r.pos,
    coalesce(nullif(trim(r.first_name), ''), 'Kumano'),
    case
      when r.referral_code ~ '^[A-Z]{2}-[0-9]{7}-[A-Z]$'
        then left(r.referral_code, 5) || '•••••' || right(r.referral_code, 2)
      when r.referral_code is not null
        then left(r.referral_code, 3) || '•••'
    end,
    r.direct_active,
    r.network_active,
    r.id = auth.uid()
  from ranked r
  where r.pos <= least(greatest(coalesce(p_limit, 100), 1), 100)
     or r.id = auth.uid()
  order by r.pos;
$$;

revoke all on function public.get_network_leaderboard(integer) from public, anon;
grant execute on function public.get_network_leaderboard(integer) to authenticated;

-- 3. Matrice: dal browser ognuno legge solo il proprio nodo. La propria rete
-- arriva da get_my_downline(), quella di altri solo allo Staff dal server.
alter table public.matrix_nodes enable row level security;
drop policy if exists matrix_nodes_select_own on public.matrix_nodes;
create policy matrix_nodes_select_own on public.matrix_nodes
  for select to authenticated using (user_id = (select auth.uid()));
-- Restrittiva: prevale su eventuali vecchie policy "visibile a tutti"
drop policy if exists matrix_nodes_own_only on public.matrix_nodes;
create policy matrix_nodes_own_only on public.matrix_nodes
  as restrictive for select to authenticated using (user_id = (select auth.uid()));
revoke select on public.matrix_nodes from anon;

-- 4. Obiettivi raggiunti: giorni contati con le date italiane
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
         greatest(0, ((a.achieved_at at time zone 'Europe/Rome')::date - (p.created_at at time zone 'Europe/Rome')::date))::int
  from public.rank_achievements a
  join public.profiles p on p.id = a.user_id
  where a.user_id = v_uid;
end;
$$;

revoke all on function public.my_rank_achievements() from public, anon;
grant execute on function public.my_rank_achievements() to authenticated;
