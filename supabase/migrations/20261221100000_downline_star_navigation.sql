-- Stella navigabile ("La mia rete"): si clicca un Kumano della propria
-- matrice e si vede la sua stella, fino al 5° livello sotto di sé.
-- get_my_downline() restituisce in più:
--  · cognome e codice completo solo dei propri invitati diretti
--    (profiles.sponsor_id = chi guarda), ovunque siano nella matrice;
--  · per tutti gli altri il codice mascherato (come nella classifica);
--  · sponsored_by_parent: se la persona è stata invitata da chi le sta
--    sopra nella stella (altrimenti è "ricevuta dalla community").
-- Resta solo la propria discendenza (n.path <@ mine.path): niente punti
-- né dati dell'abbonamento oltre a "attivo sì/no".
-- Le colonne in più cambiano il tipo restituito: la funzione va ricreata.

drop function if exists public.get_my_downline();

create function public.get_my_downline()
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
  sponsored_by_parent boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.user_id, n.parent_id, n.path::text, n.level::int, n."position"::int, n.depth::int,
         n.created_at, p.first_name::text,
         coalesce(p.subscription_status = 'active'
           and (p.subscription_expires_at is null or p.subscription_expires_at > now()), false),
         case when p.sponsor_id = mine.user_id then p.last_name::text end,
         case when p.sponsor_id = mine.user_id then p.referral_code::text end,
         case
           when p.referral_code ~ '^[A-Z]{2}-[0-9]{7}-[A-Z]$'
             then left(p.referral_code, 5) || '•••••' || right(p.referral_code, 2)
           when p.referral_code is not null
             then left(p.referral_code, 3) || '•••'
         end,
         coalesce(p.sponsor_id = mine.user_id, false),
         coalesce(p.sponsor_id = parent.user_id, false)
  from public.matrix_nodes mine
  join public.matrix_nodes n on n.path <@ mine.path and n.id <> mine.id
  left join public.matrix_nodes parent on parent.id = n.parent_id
  left join public.profiles p on p.id = n.user_id
  where mine.user_id = auth.uid()
  order by n.level;
$$;

revoke all on function public.get_my_downline() from public, anon;
grant execute on function public.get_my_downline() to authenticated;
