-- Trova Lavoro: al posto di «2 ricerche ogni 7 giorni» un credito di 40
-- pagine ogni 7 giorni (una pagina = una richiesta alla fonte). Una ricerca
-- Rapida con un nome costa 2 pagine, una Massima con 4 nomi 40: decide
-- l'utente. Si prenota il costo massimo, alla fine si paga solo quello usato.
-- Lo Staff (is_admin) non ha limiti.

alter table public.job_search_runs add column if not exists pages integer;
-- Le ricerche fatte finora valgono metà del credito ciascuna (come prima: 2 a settimana)
update public.job_search_runs set pages = 20 where pages is null;
alter table public.job_search_runs alter column pages set default 1;
alter table public.job_search_runs alter column pages set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_search_runs_pages_check') then
    alter table public.job_search_runs add constraint job_search_runs_pages_check check (pages between 1 and 100);
  end if;
end $$;

-- Pagine consentite ogni 7 giorni (null = nessun limite)
create or replace function public.job_search_week_limit()
returns int language sql stable security definer set search_path = public as $$
  select case when coalesce((select is_admin from public.profiles where id = auth.uid()), false) then null else 40 end;
$$;

-- Stato: pagine usate negli ultimi 7 giorni, credito e quando si libera la prossima parte
create or replace function public.job_search_quota()
returns jsonb language sql stable security definer set search_path = public as $$
  with runs as (
    select created_at, pages from public.job_search_runs
    where user_id = auth.uid() and created_at > now() - interval '7 days'
  )
  select jsonb_build_object(
    'used', (select coalesce(sum(pages), 0) from runs),
    'limit', public.job_search_week_limit(),
    'next_at', (select min(created_at) + interval '7 days' from runs)
  );
$$;

-- Avvia una ricerca da p_pages pagine: la registra se il credito basta
drop function if exists public.claim_job_search();
create or replace function public.claim_job_search(p_pages integer default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  max_pages int := public.job_search_week_limit();
  cost int := least(greatest(coalesce(p_pages, 1), 1), 100);
  used int;
  run_id uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;
  -- Due ricerche avviate insieme non superano il credito
  perform pg_advisory_xact_lock(hashtext('job_search_' || uid::text));
  select coalesce(sum(pages), 0) into used from public.job_search_runs where user_id = uid and created_at > now() - interval '7 days';
  if max_pages is not null and used + cost > max_pages then
    return jsonb_build_object('ok', false, 'reason', 'quota', 'limit', max_pages, 'used', used,
      'next_at', (select min(created_at) + interval '7 days' from public.job_search_runs where user_id = uid and created_at > now() - interval '7 days'));
  end if;
  insert into public.job_search_runs (user_id, pages) values (uid, cost) returning id into run_id;
  return jsonb_build_object('ok', true, 'run_id', run_id, 'limit', max_pages, 'used', used + cost,
    'next_at', (select min(created_at) + interval '7 days' from public.job_search_runs where user_id = uid and created_at > now() - interval '7 days'));
end;
$$;

-- Fine ricerca: si pagano solo le pagine davvero chieste (mai di più del prenotato)
create or replace function public.settle_job_search_for(p_run_id uuid, p_user uuid, p_pages integer)
returns void language sql security definer set search_path = public as $$
  update public.job_search_runs
  set pages = least(pages, greatest(coalesce(p_pages, 1), 1))
  where id = p_run_id and user_id = p_user and created_at > now() - interval '15 minutes';
$$;

revoke all on function public.job_search_week_limit() from public, anon;
revoke all on function public.job_search_quota() from public, anon;
revoke all on function public.claim_job_search(integer) from public, anon;
revoke all on function public.settle_job_search_for(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.job_search_week_limit() to authenticated;
grant execute on function public.job_search_quota() to authenticated;
grant execute on function public.claim_job_search(integer) to authenticated;
grant execute on function public.settle_job_search_for(uuid, uuid, integer) to service_role;
