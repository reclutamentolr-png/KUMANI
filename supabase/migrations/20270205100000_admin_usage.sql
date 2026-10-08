-- Admin → Limiti e pulizia: chi occupa più spazio e chi si avvicina ai
-- limiti. Funzioni di sola lettura, chiamate solo dal server (client di
-- servizio) dopo il controllo dei permessi dell'Admin.

-- Uso di ogni limite per persona: righe e peso stimato nel database (byte
-- delle righe, senza indici). I limiti per viaggio, menu o carta sono
-- attribuiti a chi li ha creati (si prende il viaggio/menu/carta più pieno).
create or replace function public.app_limit_usage()
returns table (user_id uuid, key text, used bigint, bytes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select user_id, 'memolife_appointments', count(*), sum(pg_column_size(t.*))::bigint from public.appointments t group by user_id
  union all select user_id, 'memolife_tasks', count(*), sum(pg_column_size(t.*))::bigint from public.tasks t group by user_id
  union all select user_id, 'memolife_notes', count(*), sum(pg_column_size(t.*))::bigint from public.notes t group by user_id
  union all select user_id, 'memolife_contacts', count(*), sum(pg_column_size(t.*))::bigint from public.contacts t group by user_id
  union all select user_id, 'lifecal_items', count(*) filter (where status = 'active'), sum(pg_column_size(t.*))::bigint from public.life_calendar_items t group by user_id
  union all select user_id, 'lifecal_profiles', count(*), sum(pg_column_size(t.*))::bigint from public.life_calendar_profiles t group by user_id
  union all select user_id, 'findo_items', count(*), sum(pg_column_size(t.*))::bigint from public.findo_items t group by user_id
  union all select user_id, 'findo_locations', count(*), sum(pg_column_size(t.*))::bigint from public.findo_locations t group by user_id
  union all select user_id, 'spendly_income', count(*), sum(pg_column_size(t.*))::bigint from public.spendly_income t group by user_id
  union all select user_id, 'spendly_fixed', count(*), sum(pg_column_size(t.*))::bigint from public.spendly_fixed_expenses t group by user_id
  union all select user_id, 'spendly_variable', count(*), sum(pg_column_size(t.*))::bigint from public.spendly_variable_expenses t group by user_id
  union all select user_id, 'quotes', count(*), sum(pg_column_size(t.*))::bigint from public.quotes t group by user_id
  union all select user_id, 'quote_clients', count(*), sum(pg_column_size(t.*))::bigint from public.quote_clients t group by user_id
  union all select user_id, 'digital_receipts', count(*), sum(pg_column_size(t.*))::bigint from public.digital_receipts t group by user_id
  union all select user_id, 'qr_codes', count(*), sum(pg_column_size(t.*))::bigint from public.qr_pro_codes t group by user_id
  union all select user_id, 'offermaker_campaigns', count(*), sum(pg_column_size(t.*))::bigint from public.offermaker_campaigns t group by user_id
  union all select user_id, 'listings_active', count(*) filter (where is_active and (expires_at is null or expires_at > now())), sum(pg_column_size(t.*))::bigint from public.listings t group by user_id
  union all select user_id, 'casa_homes', count(*), sum(pg_column_size(t.*))::bigint from public.casa_homes t group by user_id
  union all select user_id, 'casa_utilities', count(*), sum(pg_column_size(t.*))::bigint from public.casa_utilities t group by user_id
  union all select user_id, 'casa_appliances', count(*), sum(pg_column_size(t.*))::bigint from public.casa_appliances t group by user_id
  union all select user_id, 'casa_documents', count(*), sum(pg_column_size(t.*))::bigint from public.casa_documents t group by user_id
  union all select user_id, 'garage_cars', count(*) filter (where kind = 'owned' and vehicle_type = 'car'), sum(pg_column_size(t.*))::bigint from public.garage_vehicles t group by user_id
  union all select user_id, 'garage_motorbikes', count(*) filter (where kind = 'owned' and vehicle_type = 'motorbike'), 0::bigint from public.garage_vehicles t group by user_id
  union all select user_id, 'garage_rentals', count(*) filter (where kind = 'rental'), 0::bigint from public.garage_vehicles t group by user_id
  union all select user_id, 'garage_deadlines', count(*), sum(pg_column_size(t.*))::bigint from public.garage_deadlines t group by user_id
  union all select user_id, 'garage_readings', count(*), sum(pg_column_size(t.*))::bigint from public.garage_readings t group by user_id
  union all select user_id, 'garage_expenses', count(*), sum(pg_column_size(t.*))::bigint from public.garage_expenses t group by user_id
  union all select user_id, 'garage_documents', count(*), sum(pg_column_size(t.*))::bigint from public.garage_documents t group by user_id
  -- Per menu / carta / viaggio: il più pieno di ogni proprietario, peso sommato
  union all select m.owner_id, 'menu_categories', max(x.n), sum(x.b)::bigint from public.menus m join (select menu_id, count(*) n, sum(pg_column_size(t.*)) b from public.menu_categories t group by menu_id) x on x.menu_id = m.id group by m.owner_id
  union all select m.owner_id, 'menu_items', max(x.n), sum(x.b)::bigint from public.menus m join (select menu_id, count(*) n, sum(pg_column_size(t.*)) b from public.menu_items t group by menu_id) x on x.menu_id = m.id group by m.owner_id
  union all select c.owner_id, 'fidelity_members', max(x.n), sum(x.b)::bigint from public.fidelity_cards c join (select card_id, count(*) n, sum(pg_column_size(t.*)) b from public.fidelity_members t group by card_id) x on x.card_id = c.id group by c.owner_id
  union all select tr.creator_id, 'trip_activities', max(x.n), sum(x.b)::bigint from public.trips tr join (select trip_id, count(*) n, sum(pg_column_size(t.*)) b from public.trip_activities t group by trip_id) x on x.trip_id = tr.id group by tr.creator_id
  union all select tr.creator_id, 'trip_checklist', max(x.n), sum(x.b)::bigint from public.trips tr join (select trip_id, count(*) n, sum(pg_column_size(t.*)) b from public.trip_checklist t group by trip_id) x on x.trip_id = tr.id group by tr.creator_id
  union all select tr.creator_id, 'trip_expenses', max(x.n), sum(x.b)::bigint from public.trips tr join (select trip_id, count(*) n, sum(pg_column_size(t.*)) b from public.trip_expenses t group by trip_id) x on x.trip_id = tr.id group by tr.creator_id
  union all select tr.creator_id, 'trip_documents', max(x.n), sum(x.b)::bigint from public.trips tr join (select trip_id, count(*) n, sum(pg_column_size(t.*)) b from public.trip_documents t group by trip_id) x on x.trip_id = tr.id group by tr.creator_id
$$;
revoke all on function public.app_limit_usage() from public, anon, authenticated;
grant execute on function public.app_limit_usage() to service_role;

-- File di ogni persona (cartella "<id utente>/…" in qualsiasi spazio)
create or replace function public.app_storage_usage()
returns table (user_id uuid, bucket text, files bigint, bytes bigint)
language sql
stable
security definer
set search_path = public, storage
as $$
  select p.id, o.bucket_id::text, count(*), coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  from storage.objects o
  join public.profiles p on p.id::text = split_part(o.name, '/', 1)
  group by p.id, o.bucket_id
$$;
revoke all on function public.app_storage_usage() from public, anon, authenticated;
grant execute on function public.app_storage_usage() to service_role;

-- I 10 (o p_limit) che occupano più spazio: file + dati stimati
create or replace function public.admin_usage_top(p_limit integer default 10)
returns table (user_id uuid, name text, email text, file_bytes bigint, files bigint, db_bytes bigint, db_rows bigint, buckets jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select user_id, sum(bytes) as bytes, sum(files) as files,
           jsonb_object_agg(bucket, jsonb_build_object('files', files, 'bytes', bytes)) as buckets
    from public.app_storage_usage() group by user_id
  ),
  d as (
    select user_id, sum(bytes) as bytes, sum(used) as rows from public.app_limit_usage() where user_id is not null group by user_id
  ),
  u as (
    select coalesce(f.user_id, d.user_id) as user_id,
           coalesce(f.bytes, 0)::bigint as file_bytes, coalesce(f.files, 0)::bigint as files,
           coalesce(d.bytes, 0)::bigint as db_bytes, coalesce(d.rows, 0)::bigint as db_rows,
           coalesce(f.buckets, '{}'::jsonb) as buckets
    from f full join d on d.user_id = f.user_id
  )
  select u.user_id, nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email,
         u.file_bytes, u.files, u.db_bytes, u.db_rows, u.buckets
  from u left join public.profiles p on p.id = u.user_id
  order by u.file_bytes + u.db_bytes desc
  limit greatest(1, least(p_limit, 100))
$$;
revoke all on function public.admin_usage_top(integer) from public, anon, authenticated;
grant execute on function public.admin_usage_top(integer) to service_role;

-- I 10 (o p_limit) più vicini a un limite: per ognuno il limite più pieno
-- (righe e file), con quanto ha usato e la percentuale
create or replace function public.admin_limits_top(p_limit integer default 10)
returns table (user_id uuid, name text, email text, key text, section text, label text, used bigint, max integer, pct numeric)
language sql
stable
security definer
set search_path = public
as $$
  with usage as (
    select user_id, key, used from public.app_limit_usage() where user_id is not null
    union all
    select user_id, 'files_' || bucket, files from public.app_storage_usage()
  ),
  scored as (
    select u.user_id, u.key, l.section, l.label, u.used, l.value as max,
           round(u.used * 100.0 / l.value, 1) as pct,
           row_number() over (partition by u.user_id order by u.used::numeric / l.value desc) as rn
    from usage u join public.app_limits l on l.key = u.key and l.value > 0
    where u.used > 0
  )
  select s.user_id, nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email,
         s.key, s.section, s.label, s.used, s.max, s.pct
  from scored s left join public.profiles p on p.id = s.user_id
  where s.rn = 1
  order by s.pct desc, s.used desc
  limit greatest(1, least(p_limit, 100))
$$;
revoke all on function public.admin_limits_top(integer) from public, anon, authenticated;
grant execute on function public.admin_limits_top(integer) to service_role;
