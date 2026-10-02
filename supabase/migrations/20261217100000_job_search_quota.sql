-- Trova Lavoro: limite di ricerche per utente (fase di prova: 2 ogni 7
-- giorni). Ogni ricerca avviata lascia una riga; se la fonte non risponde la
-- riga si toglie e la ricerca non conta. Lo Staff (is_admin) non ha limiti.
create table if not exists public.job_search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists job_search_runs_user_idx on public.job_search_runs (user_id, created_at desc);
alter table public.job_search_runs enable row level security;
drop policy if exists "job_search_runs_select_own" on public.job_search_runs;
create policy "job_search_runs_select_own" on public.job_search_runs for select using (user_id = auth.uid());

-- Ricerche consentite ogni 7 giorni (null = nessun limite)
create or replace function public.job_search_week_limit()
returns int language sql stable security definer set search_path = public as $$
  select case when coalesce((select is_admin from public.profiles where id = auth.uid()), false) then null else 2 end;
$$;

-- Stato: usate negli ultimi 7 giorni, limite e quando si libera la prossima
create or replace function public.job_search_quota()
returns jsonb language sql stable security definer set search_path = public as $$
  with runs as (
    select created_at from public.job_search_runs
    where user_id = auth.uid() and created_at > now() - interval '7 days'
    order by created_at
  )
  select jsonb_build_object(
    'used', (select count(*) from runs),
    'limit', public.job_search_week_limit(),
    'next_at', (select min(created_at) + interval '7 days' from runs)
  );
$$;

-- Avvia una ricerca: la registra se c'è ancora posto, altrimenti risponde no
create or replace function public.claim_job_search()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  max_runs int := public.job_search_week_limit();
  used int;
  run_id uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;
  -- Due ricerche avviate insieme non superano il limite
  perform pg_advisory_xact_lock(hashtext('job_search_' || uid::text));
  select count(*) into used from public.job_search_runs where user_id = uid and created_at > now() - interval '7 days';
  if max_runs is not null and used >= max_runs then
    return jsonb_build_object('ok', false, 'reason', 'quota', 'limit', max_runs,
      'next_at', (select min(created_at) + interval '7 days' from public.job_search_runs where user_id = uid and created_at > now() - interval '7 days'));
  end if;
  insert into public.job_search_runs (user_id) values (uid) returning id into run_id;
  return jsonb_build_object('ok', true, 'run_id', run_id, 'limit', max_runs, 'used', used + 1,
    'next_at', (select min(created_at) + interval '7 days' from public.job_search_runs where user_id = uid and created_at > now() - interval '7 days'));
end;
$$;

-- Ricerca non riuscita per colpa della fonte: non conta
create or replace function public.refund_job_search(p_run_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.job_search_runs
  where id = p_run_id and user_id = auth.uid() and created_at > now() - interval '15 minutes';
$$;

revoke all on function public.job_search_week_limit() from public, anon;
revoke all on function public.job_search_quota() from public, anon;
revoke all on function public.claim_job_search() from public, anon;
revoke all on function public.refund_job_search(uuid) from public, anon;
grant execute on function public.job_search_week_limit() to authenticated;
grant execute on function public.job_search_quota() to authenticated;
grant execute on function public.claim_job_search() to authenticated;
grant execute on function public.refund_job_search(uuid) to authenticated;
