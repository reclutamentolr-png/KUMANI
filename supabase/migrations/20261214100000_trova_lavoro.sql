-- Trova Lavoro: ricerca di offerte di lavoro da fonti esterne (Careerjet).
-- KUMANI non ospita annunci e non raccoglie CV: salva solo i preferiti e le
-- ricerche dell'utente. Strumento del piano Base.

insert into public.marketplace_settings (tool_name, is_enabled, required_plan)
values ('trova-lavoro', true, 'base')
on conflict (tool_name) do nothing;

-- Annunci salvati per rivederli con calma (copia dei dati mostrati: la fonte
-- non garantisce che l'annuncio resti online)
create table if not exists public.job_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_key text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, job_key)
);
create index if not exists job_favorites_user_idx on public.job_favorites (user_id, created_at desc);

-- Ricerche salvate (solo i filtri)
create table if not exists public.job_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  filters jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists job_searches_user_idx on public.job_searches (user_id, created_at desc);

alter table public.job_favorites enable row level security;
alter table public.job_searches enable row level security;

drop policy if exists job_favorites_own on public.job_favorites;
create policy job_favorites_own on public.job_favorites
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists job_searches_own on public.job_searches;
create policy job_searches_own on public.job_searches
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Scrivere solo con il piano che include lo strumento (leggere e cancellare
-- restano possibili anche dopo)
drop policy if exists job_favorites_plan_insert on public.job_favorites;
create policy job_favorites_plan_insert on public.job_favorites as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('trova-lavoro') t where t.allowed));
drop policy if exists job_searches_plan_insert on public.job_searches;
create policy job_searches_plan_insert on public.job_searches as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('trova-lavoro') t where t.allowed));

-- Limiti per utente: al massimo 300 preferiti e 30 ricerche salvate
create or replace function public.job_limits_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'job_favorites' and (select count(*) from public.job_favorites where user_id = new.user_id) >= 300 then
    raise exception 'job_favorites_limit';
  end if;
  if tg_table_name = 'job_searches' and (select count(*) from public.job_searches where user_id = new.user_id) >= 30 then
    raise exception 'job_searches_limit';
  end if;
  return new;
end;
$$;
drop trigger if exists job_favorites_limit on public.job_favorites;
create trigger job_favorites_limit before insert on public.job_favorites for each row execute function public.job_limits_check();
drop trigger if exists job_searches_limit on public.job_searches;
create trigger job_searches_limit before insert on public.job_searches for each row execute function public.job_limits_check();
