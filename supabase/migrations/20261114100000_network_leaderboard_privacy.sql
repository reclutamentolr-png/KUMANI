-- Classifica della pagina Rete calcolata nel database.
-- Prima il browser scaricava nome, cognome e codice unico di TUTTI i profili
-- (più l'intera matrice) e calcolava la classifica da sé. Ora riceve solo:
-- posizione, nome (senza cognome), codice mascherato e i due conteggi.
--
-- Codice mascherato: IT-1234567-A -> IT-12•••••-A (formati diversi: prime
-- 3 lettere + •••).
-- "Attivo" = subscription_status 'active' e scadenza assente o futura
-- (stessa regola di isActiveSubscription in src/lib/subscriptionGate.ts).
-- Restituisce le prime p_limit posizioni più la riga di chi chiama (is_me),
-- così la posizione personale si vede anche fuori dalla Top 100.

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
  ),
  stats as (
    select m.id, m.first_name, m.referral_code,
      (select count(*) from members d where d.sponsor_id = m.id and d.active)::int as direct_active,
      coalesce((
        select count(*)
        from public.matrix_nodes mine
        join public.matrix_nodes below on below.path <@ mine.path and below.user_id <> m.id
        join members bm on bm.id = below.user_id and bm.active
        where mine.user_id = m.id
      ), 0)::int as network_active
    from members m
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
