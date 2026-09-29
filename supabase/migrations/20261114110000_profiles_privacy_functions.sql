-- Privacy dei Kumani, parte 1 (solo aggiunte, compatibile col codice attuale).
-- Gli altri Kumani vedono solo il nome e, dove serve, il codice mascherato;
-- cognome e codice completo restano visibili a sé stessi, allo sponsor
-- (KUMI) e ai propri invitati diretti, e allo Staff.
-- La parte 2 (20261114120000_profiles_privacy_revoke.sql) toglie i permessi
-- di lettura diretta: va applicata DOPO il deploy del codice che usa queste
-- funzioni.

-- La propria matrice (discendenti): solo nome e stato attivo, niente
-- cognome, codice o username di chi ci è finito sotto (anche per spillover).
create or replace function public.get_my_downline()
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
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.user_id, n.parent_id, n.path::text, n.level::int, n."position"::int, n.depth::int,
         n.created_at, p.first_name::text,
         coalesce(p.subscription_status = 'active'
           and (p.subscription_expires_at is null or p.subscription_expires_at > now()), false)
  from public.matrix_nodes mine
  join public.matrix_nodes n on n.path <@ mine.path and n.id <> mine.id
  left join public.profiles p on p.id = n.user_id
  where mine.user_id = auth.uid()
  order by n.level;
$$;
revoke all on function public.get_my_downline() from public, anon;
grant execute on function public.get_my_downline() to authenticated;

-- Il proprio sponsor (KUMI): nome, cognome e codice, come prima.
create or replace function public.get_my_sponsor()
returns table (first_name text, last_name text, referral_code text)
language sql
stable
security definer
set search_path = public
as $$
  select s.first_name::text, s.last_name::text, s.referral_code::text
  from public.profiles me
  join public.profiles s on s.id = me.sponsor_id
  where me.id = auth.uid();
$$;
revoke all on function public.get_my_sponsor() from public, anon;
grant execute on function public.get_my_sponsor() to authenticated;

-- Pagine di invito (/ref/..., /strumenti/...): chi invita è mostrato solo col
-- nome. Stessa firma di prima, il cognome torna sempre vuoto.
create or replace function public.get_public_profile_by_referral(p_referral_code text)
returns table (first_name text, last_name text, country_code character, referral_code text)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  select p.first_name, ''::text, p.country_code, p.referral_code
  from public.profiles p
  where p.referral_code = p_referral_code
    and p.is_active = true
    and not coalesce(p.is_blocked, false);
end;
$function$;

-- Vecchie classifiche mai usate dal sito, eseguibili da chiunque (anche non
-- loggato): restituivano nome, cognome e codice completo dei primi utenti.
revoke all on function public.get_direct_recruiter_leaderboard(integer) from public, anon, authenticated;
revoke all on function public.get_total_structure_leaderboard(integer) from public, anon, authenticated;
revoke all on function public.get_user_rankings(uuid) from public, anon, authenticated;

-- Funzione dell'ultimo elenco "nuovi iscritti" (non più usata dal sito),
-- presente solo sul database: se esiste, non è più eseguibile dagli utenti.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'get_public_latest_users'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
