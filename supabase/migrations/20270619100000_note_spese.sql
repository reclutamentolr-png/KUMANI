-- NOTE SPESE E RIMBORSO CHILOMETRICO (KUMANI Lavoro, piano Plus): chi
-- anticipa spese di lavoro o usa la propria auto raccoglie le voci con la
-- foto dello scontrino, vede i totali e scarica il PDF da consegnare
-- all'azienda. Importi in centesimi interi. Foto nello spazio privato
-- expense-receipts (cartella <id utente>/<id nota>/), mostrate con link
-- firmati che scadono.

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('note-spese', false, true, 'base', 'Note spese e rimborso chilometrico – voci con foto dello scontrino, chilometri con l''auto propria, totali, PDF con firme e allegati, CSV')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('note-spese', 'Note spese', 1, 10)
on conflict (key) do nothing;

-- Nota spese: una trasferta o un periodo (es. «Trasferta Milano marzo 2027»)
create table if not exists public.expense_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  employee_name text check (char_length(employee_name) <= 120),
  recipient text check (char_length(recipient) <= 160),
  period_from date,
  period_to date,
  status text not null default 'open' check (status in ('open', 'submitted', 'reimbursed')),
  submitted_on date,
  reimbursed_on date,
  advance_cents integer not null default 0 check (advance_cents >= 0 and advance_cents <= 100000000),
  -- Tariffa al km scelta dall'utente (vuota finché non la scrive)
  km_rate numeric(6, 4) check (km_rate is null or (km_rate > 0 and km_rate <= 10)),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_from is null or period_to is null or period_to >= period_from),
  check (status <> 'reimbursed' or reimbursed_on is not null)
);
create index if not exists expense_reports_user_idx on public.expense_reports (user_id, created_at desc);

-- Voce di spesa; per i chilometri l'importo lo calcola il database
create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.expense_reports(id) on delete cascade,
  spent_on date not null,
  category text not null check (category in ('meals', 'lodging', 'transport', 'taxi', 'parking', 'fuel', 'mileage', 'other')),
  description text not null default '' check (char_length(description) <= 200),
  amount_cents integer not null check (amount_cents >= 0 and amount_cents <= 10000000),
  route_from text check (char_length(route_from) <= 120),
  route_to text check (char_length(route_to) <= 120),
  km numeric(8, 1) check (km is null or (km > 0 and km <= 50000)),
  round_trip boolean not null default false,
  km_rate numeric(6, 4) check (km_rate is null or (km_rate > 0 and km_rate <= 10)),
  receipt_path text check (char_length(receipt_path) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- I chilometri vogliono km e tariffa; le altre voci non li hanno
  check ((category = 'mileage') = (km is not null and km_rate is not null)),
  -- La foto deve stare nella cartella di chi la registra
  check (receipt_path is null or split_part(receipt_path, '/', 1) = user_id::text)
);
create index if not exists expense_items_report_idx on public.expense_items (report_id, spent_on, created_at);
create index if not exists expense_items_user_idx on public.expense_items (user_id);
create unique index if not exists expense_items_receipt_path_key on public.expense_items (receipt_path) where receipt_path is not null;

-- Rimborso chilometrico: km (doppi con andata e ritorno) × tariffa, al centesimo
create or replace function public.expense_items_mileage_amount()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category = 'mileage' then
    new.amount_cents := round(new.km * (case when new.round_trip then 2 else 1 end) * new.km_rate * 100)::integer;
  else
    new.route_from := null;
    new.route_to := null;
    new.round_trip := false;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists expense_items_mileage on public.expense_items;
create trigger expense_items_mileage before insert or update on public.expense_items
  for each row execute function public.expense_items_mileage_amount();

-- La voce deve appartenere a una nota spese della stessa persona
drop trigger if exists expense_items_own_report on public.expense_items;
create trigger expense_items_own_report before insert or update of report_id, user_id on public.expense_items
  for each row execute function public.check_own_reference('report_id', 'expense_reports');

-- Regole di accesso: ognuno vede e cambia solo i propri dati; per creare e
-- modificare serve il servizio acceso e il piano giusto (can_use_tool)
do $$
declare
  t text;
begin
  foreach t in array array['expense_reports', 'expense_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete', t);
    execute format('drop policy if exists %I on public.%I', t || '_plan_insert', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (exists (select 1 from public.can_use_tool(%L) x where x.allowed))', t || '_plan_insert', t, 'note-spese');
    execute format('drop policy if exists %I on public.%I', t || '_plan_update', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (exists (select 1 from public.can_use_tool(%L) x where x.allowed))', t || '_plan_update', t, 'note-spese');
    execute format('drop trigger if exists app_limit_check on public.%I', t);
    execute format('create trigger app_limit_check before insert on public.%I for each row execute function public.enforce_app_limit(%L, %L)', t, t, 'user_id');
  end loop;
end;
$$;

insert into public.app_limits (key, value, kind, section, label, sort) values
  ('expense_reports', 1000, 'count', 'Note spese', 'Note spese per persona', 90),
  ('expense_items', 20000, 'count', 'Note spese', 'Voci di spesa per persona', 91),
  ('files_expense-receipts', 5000, 'files', 'File per persona', 'Foto degli scontrini (Note spese)', 208)
on conflict (key) do nothing;

-- Spazio privato delle foto degli scontrini: al massimo 3 MB per foto (le
-- foto arrivano già ridotte dal browser a circa 200–400 KB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists expense_receipts_select on storage.objects;
create policy expense_receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists expense_receipts_insert on storage.objects;
create policy expense_receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.can_use_tool('note-spese') x where x.allowed));
drop policy if exists expense_receipts_delete on storage.objects;
create policy expense_receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Pulizia notturna: anche le foto degli scontrini caricate e poi lasciate
-- («Annulla», pagina chiusa) o rimaste senza voce
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
  union all
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'expense-receipts'
     and o.created_at < age.before
     and not exists (select 1 from public.expense_items i where i.receipt_path = o.name)
   limit p_limit)
$function$;
revoke all on function public.storage_orphans(integer) from public, anon, authenticated;
grant execute on function public.storage_orphans(integer) to service_role;
