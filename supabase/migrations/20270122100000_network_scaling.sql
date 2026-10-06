-- Rete veloce anche con tanti iscritti.
-- Prima "La mia rete" leggeva TUTTA la propria discendenza (get_my_downline:
-- per chi sta in cima, l'intera matrice) e la dashboard/Community tutti gli
-- invitati diretti con il telefono, solo per mostrarne i conteggi.
-- Ora:
--  · get_my_downline_star(): solo i Kumani attivi fino al 5° livello (quelli
--    che la stella può mostrare), letti scendendo per parent_id, con già
--    contati i Kumani attivi sotto ciascuno (il numero nella stella);
--  · get_my_network_totals(): totale della discendenza, livelli e invitati
--    diretti finiti più in basso con lo spillover, contati dal database;
--  · my_network_summary(): i tre numeri del riepilogo (KUMANI attivi, non
--    ancora KUMANI, ricevuti dalla community) senza leggere gli elenchi.
-- get_my_downline() e get_my_direct_sponsored() restano (l'elenco completo
-- degli invitati diretti serve ancora alla pagina "La mia rete").

-- 1. Indici usati da queste funzioni (già presenti nel database: qui per
--    averli anche in un database ricreato dalle migrazioni)
create index if not exists idx_matrix_parent on public.matrix_nodes (parent_id);
create index if not exists idx_matrix_nodes_path_gist on public.matrix_nodes using gist (path);
create index if not exists idx_matrix_nodes_user_id on public.matrix_nodes (user_id);
create index if not exists idx_profiles_sponsor_id on public.profiles (sponsor_id);

-- 2. Stella: stesse colonne di get_my_downline() (vedi
--    20261221100000_downline_star_navigation.sql) più active_downline_count,
--    solo i Kumani attivi e al massimo p_max_depth livelli sotto di sé.
create or replace function public.get_my_downline_star(p_max_depth integer default 5)
returns table (
  id uuid,
  user_id uuid,
  parent_id uuid,
  path text,
  level integer,
  "position" integer,
  depth integer,
  created_at timestamptz,
  first_name text,
  is_active boolean,
  last_name text,
  referral_code text,
  masked_code text,
  is_my_direct boolean,
  sponsored_by_parent boolean,
  active_downline_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive
  mine as (
    select m.id, m.user_id, m.path, least(greatest(coalesce(p_max_depth, 5), 1), 10) as max_rel
    from public.matrix_nodes m
    where m.user_id = auth.uid()
  ),
  -- Discesa per parent_id (indice), fermandosi al livello massimo: al più
  -- 5 + 25 + 125 + 625 + 3125 posti, qualunque sia la grandezza della rete
  star as (
    select n.id, n.user_id, n.parent_id, n.path, n.level, n."position", n.depth, n.created_at,
           mine.user_id as parent_user_id, 1 as rel
    from mine
    join public.matrix_nodes n on n.parent_id = mine.id
    union all
    select n.id, n.user_id, n.parent_id, n.path, n.level, n."position", n.depth, n.created_at,
           s.user_id, s.rel + 1
    from star s
    join public.matrix_nodes n on n.parent_id = s.id
    where s.rel < (select max_rel from mine)
  ),
  active_star as (
    select s.*, p.first_name, p.last_name, p.referral_code, p.sponsor_id
    from star s
    join public.profiles p on p.id = s.user_id
    where p.subscription_status = 'active'
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
  ),
  -- Kumani attivi sotto ciascun posto della stella (a qualunque profondità,
  -- come prima): ogni attivo conta una volta per ciascun antenato entro il
  -- livello massimo, contato qui invece di mandare tutte le righe
  active_counts as (
    select subpath(n.path, 0, nlevel(mine.path) + k) as anc_path, count(*)::int as n
    from mine
    join public.matrix_nodes n
      on n.path <@ mine.path and nlevel(n.path) > nlevel(mine.path) + 1
    join public.profiles p
      on p.id = n.user_id
     and p.subscription_status = 'active'
     and (p.subscription_expires_at is null or p.subscription_expires_at > now())
    cross join lateral generate_series(1, least(nlevel(n.path) - nlevel(mine.path) - 1, mine.max_rel)) as k
    group by 1
  )
  select a.id, a.user_id, a.parent_id, a.path::text, a.level::int, a."position"::int, a.depth::int,
         a.created_at, a.first_name::text,
         true,
         case when a.sponsor_id = mine.user_id then a.last_name::text end,
         case when a.sponsor_id = mine.user_id then a.referral_code::text end,
         case
           when a.referral_code ~ '^[A-Z]{2}-[0-9]{7}-[A-Z]$'
             then left(a.referral_code, 5) || '•••••' || right(a.referral_code, 2)
           when a.referral_code is not null
             then left(a.referral_code, 3) || '•••'
         end,
         coalesce(a.sponsor_id = mine.user_id, false),
         coalesce(a.sponsor_id = a.parent_user_id, false),
         coalesce(c.n, 0)
  from active_star a
  cross join mine
  left join active_counts c on c.anc_path = a.path
  order by a.level;
$$;

revoke all on function public.get_my_downline_star(integer) from public, anon;
grant execute on function public.get_my_downline_star(integer) to authenticated;

-- 3. Numeri della rete su tutta la discendenza (attivi e no): quanti sotto
--    di sé, fino a che livello, e quanti invitati diretti sono finiti più in
--    basso dei propri 5 posti con lo spillover.
create or replace function public.get_my_network_totals()
returns table (
  total_downline integer,
  max_depth integer,
  direct_in_spillover integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.matrix_nodes n where n.path <@ mine.path and n.id <> mine.id),
    coalesce((select max(nlevel(n.path))::int from public.matrix_nodes n where n.path <@ mine.path and n.id <> mine.id)
      - nlevel(mine.path), 0),
    (select count(*)::int
       from public.profiles p
       join public.matrix_nodes n on n.user_id = p.id
      where p.sponsor_id = mine.user_id
        and n.path <@ mine.path
        and n.id <> mine.id
        and n.parent_id is distinct from mine.id)
  from public.matrix_nodes mine
  where mine.user_id = auth.uid();
$$;

revoke all on function public.get_my_network_totals() from public, anon;
grant execute on function public.get_my_network_totals() to authenticated;

-- 4. Riepilogo della rete (dashboard e Community): solo i conteggi.
--    Attivi/non attivi come get_my_direct_sponsored() + isActiveSubscription,
--    ricevuti come my_received_kumani().
create or replace function public.my_network_summary()
returns table (
  active_direct integer,
  pending_direct integer,
  received integer
)
language sql
stable
security definer
set search_path = public
as $$
  with direct as (
    select coalesce(p.subscription_status = 'active'
             and (p.subscription_expires_at is null or p.subscription_expires_at > now()), false) as active
    from public.profiles p
    where p.sponsor_id = auth.uid()
  )
  select
    (select count(*)::int from direct where active),
    (select count(*)::int from direct where not active),
    (select count(*)::int
       from public.matrix_nodes mine
       join public.matrix_nodes child on child.parent_id = mine.id
       join public.profiles p on p.id = child.user_id
      where mine.user_id = auth.uid()
        and p.sponsor_id is distinct from auth.uid()
        and p.subscription_status = 'active'
        and (p.subscription_expires_at is null or p.subscription_expires_at > now()));
$$;

revoke all on function public.my_network_summary() from public, anon;
grant execute on function public.my_network_summary() to authenticated;
