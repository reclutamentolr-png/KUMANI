-- Ottimizzazione: my_rank_achievements() ora legge soltanto. Prima a ogni
-- apertura di Home, Wallet e Rete (due volte sulla Rete) ricalcolava e
-- scriveva qualifiche e premi. Il ricalcolo resta:
--  - quando arrivano punti o attivazioni (record_network_badges nei trigger);
--  - ogni giorno col cron (evaluate_due_qualifications, punti confermati);
--  - all'apertura della Home, dopo aver mostrato la pagina
--    (refresh_my_qualifications, chiamata in differita).
create or replace function public.my_rank_achievements()
returns table (rank_key text, achieved_at timestamptz, days integer)
language sql
stable
security definer
set search_path = public
as $$
  select a.rank_key, a.achieved_at,
         greatest(0, ((a.achieved_at at time zone 'Europe/Rome')::date - (p.created_at at time zone 'Europe/Rome')::date))::int
  from public.rank_achievements a
  join public.profiles p on p.id = a.user_id
  where a.user_id = auth.uid();
$$;

create or replace function public.refresh_my_qualifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    perform public.record_network_badges(auth.uid());
  end if;
end;
$$;
revoke all on function public.refresh_my_qualifications() from public, anon;
grant execute on function public.refresh_my_qualifications() to authenticated;
