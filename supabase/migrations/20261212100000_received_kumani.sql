-- "Ricevuti dalla community": i Kumani attivi nei propri 5 posti diretti
-- della stella che sono stati invitati da qualcun altro (arrivati dall'alto
-- con lo spillover). Sono quelli del Bonus Struttura: senza questo elenco chi
-- li ha ricevuti vede qualcuno nella stella ma "0 KUMANI attivi".
-- Solo il nome (come get_my_downline) e da quando sono nella stella.
create or replace function public.my_received_kumani()
returns table (first_name text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.first_name::text, child.created_at
  from public.matrix_nodes mine
  join public.matrix_nodes child on child.parent_id = mine.id
  join public.profiles p on p.id = child.user_id
  where mine.user_id = auth.uid()
    and p.sponsor_id is distinct from auth.uid()
    and p.subscription_status = 'active'
    and (p.subscription_expires_at is null or p.subscription_expires_at > now())
  order by child."position";
$$;
revoke all on function public.my_received_kumani() from public, anon;
grant execute on function public.my_received_kumani() to authenticated;
