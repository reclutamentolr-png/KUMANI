-- KUMANI PRO «Clienti e Lavori» (fase 3): tempo sul lavoro (cronometro e
-- ore aggiunte a mano) con costo orario, costi del lavoro (materiali anche
-- dal Magazzino e altre spese) per il margine, foto e documenti del lavoro
-- in uno spazio privato (link firmati che scadono).

alter table public.client_jobs add column if not exists hourly_cost numeric(8, 2)
  check (hourly_cost is null or (hourly_cost >= 0 and hourly_cost <= 10000));

-- Tempo: una riga per sessione; ended_at vuoto = cronometro acceso
create table if not exists public.job_time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.client_jobs(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  check (ended_at is null or (ended_at > started_at and ended_at - started_at <= interval '7 days'))
);
create index if not exists job_time_entries_job_idx on public.job_time_entries (job_id, started_at desc);
-- Un solo cronometro acceso per persona
create unique index if not exists job_time_entries_one_running on public.job_time_entries (user_id) where ended_at is null;

-- Costi: materiali (anche prodotti del Magazzino) e altre spese
create table if not exists public.job_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.client_jobs(id) on delete cascade,
  kind text not null default 'material' check (kind in ('material', 'expense')),
  description text not null check (char_length(description) between 1 and 200),
  quantity numeric(12, 3) not null default 1 check (quantity > 0 and quantity <= 1000000),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0 and unit_cost <= 10000000),
  product_id uuid references public.inventory_products(id) on delete set null,
  stock_unloaded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists job_costs_job_idx on public.job_costs (job_id, created_at);

-- Foto e documenti: il file sta nello spazio privato job-files
create table if not exists public.job_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.client_jobs(id) on delete cascade,
  path text not null unique check (char_length(path) <= 300),
  name text not null check (char_length(name) between 1 and 200),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size integer not null check (size > 0 and size <= 10485760),
  created_at timestamptz not null default now()
);
create index if not exists job_files_job_idx on public.job_files (job_id, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['job_time_entries', 'job_costs', 'job_files'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_owner', t);
    execute format('drop policy if exists %I on public.%I', t || '_plan_insert', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (exists (select 1 from public.can_use_tool(%L) x where x.allowed))', t || '_plan_insert', t, 'clienti');
    execute format('drop policy if exists %I on public.%I', t || '_plan_update', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (exists (select 1 from public.can_use_tool(%L) x where x.allowed))', t || '_plan_update', t, 'clienti');
    execute format('drop trigger if exists %I on public.%I', t || '_own_job', t);
    execute format('create trigger %I before insert or update of job_id on public.%I for each row execute function public.check_own_reference(%L, %L)', t || '_own_job', t, 'job_id', 'client_jobs');
    execute format('drop trigger if exists app_limit_check on public.%I', t);
    execute format('create trigger app_limit_check before insert on public.%I for each row execute function public.enforce_app_limit(%L, %L)', t, t, 'user_id');
  end loop;
end;
$$;

-- Il file registrato deve stare nella propria cartella
alter table public.job_files drop constraint if exists job_files_path_owner;
alter table public.job_files add constraint job_files_path_owner check (split_part(path, '/', 1) = user_id::text);

insert into public.app_limits (key, value, kind, section, label, sort) values
  ('job_time_entries', 20000, 'count', 'Clienti e Lavori', 'Sessioni di tempo per persona', 74),
  ('job_costs', 10000, 'count', 'Clienti e Lavori', 'Costi dei lavori per persona', 75),
  ('job_files', 1000, 'count', 'Clienti e Lavori', 'Foto e documenti dei lavori per persona', 76),
  ('files_job-files', 1000, 'files', 'File per persona', 'Foto e documenti dei lavori', 207)
on conflict (key) do nothing;

-- Spazio privato dei file dei lavori: cartella <id utente>/<id lavoro>/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-files', 'job-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists job_files_select on storage.objects;
create policy job_files_select on storage.objects for select to authenticated
  using (bucket_id = 'job-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists job_files_insert on storage.objects;
create policy job_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'job-files' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.can_use_tool('clienti') x where x.allowed));
drop policy if exists job_files_delete on storage.objects;
create policy job_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'job-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Pulizia notturna: anche i file dei lavori rimasti senza riga (lavoro eliminato)
create or replace function public.storage_orphans(p_limit integer DEFAULT 500)
 RETURNS TABLE(bucket text, name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
  with age as (
    select now() - make_interval(days => coalesce(public.app_limit('days_orphan_files'), 7)) as before
  )
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'cv-photos'
     and o.created_at < age.before
     and not exists (select 1 from public.cvs c where c.photo_path = o.name)
   limit p_limit)
  union all
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'quote-logos-v2'
     and o.name like '%/quote-images/%'
     and o.created_at < age.before
     and not exists (select 1 from public.quotes q where q.sections::text like '%' || o.name || '%')
     and not exists (select 1 from public.quote_issuer_profiles p where coalesce(p.quote_presets::text, '') like '%' || o.name || '%')
   limit p_limit)
  union all
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'findo-photos'
     and o.created_at < age.before
     and not exists (select 1 from public.findo_items f where f.photo_path = o.name)
   limit p_limit)
  union all
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'receipt-photos-v2'
     and o.created_at < age.before
     and not exists (select 1 from public.digital_receipts r where r.photo_path = o.name)
   limit p_limit)
  union all
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'job-files'
     and o.created_at < age.before
     and not exists (select 1 from public.job_files f where f.path = o.name)
   limit p_limit)
$function$;
revoke all on function public.storage_orphans(integer) from public, anon, authenticated;
grant execute on function public.storage_orphans(integer) to service_role;
