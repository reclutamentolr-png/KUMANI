-- Admin → Piattaforme collegate: spazio e uso del database Supabase.
-- Solo lettura, chiamabile solo dal server (chiave di servizio).
create or replace function public.admin_platform_db_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', (
      select coalesce(jsonb_agg(t order by (t ->> 'bytes')::bigint desc), '[]'::jsonb)
      from (
        select jsonb_build_object('name', c.relname, 'bytes', pg_total_relation_size(c.oid), 'rows', c.reltuples::bigint) as t
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc
        limit 8
      ) top
    ),
    'storage', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'bytes', bytes, 'files', files) order by bytes desc), '[]'::jsonb)
      from (
        select bucket_id, sum(coalesce((metadata ->> 'size')::bigint, 0)) as bytes, count(*) as files
        from storage.objects
        group by bucket_id
      ) s
    ),
    'users', (select count(*) from auth.users),
    'active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'new_30d', (select count(*) from auth.users where created_at > now() - interval '30 days')
  );
$$;
revoke all on function public.admin_platform_db_stats() from public, anon, authenticated;
grant execute on function public.admin_platform_db_stats() to service_role;
