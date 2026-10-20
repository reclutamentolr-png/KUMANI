-- Quanti si sono iscritti partendo da una pagina (es. il test anti-truffa:
-- /register?da=test-truffa salva signup_from nei metadati dell'account).
-- Solo per il server (service role): Admin → Rete Anti-Truffa.
create or replace function public.signup_from_stats(p_source text)
returns table (total bigint, last30 bigint, last7 bigint)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    count(*),
    count(*) filter (where u.created_at > now() - interval '30 days'),
    count(*) filter (where u.created_at > now() - interval '7 days')
  from auth.users u
  where u.raw_user_meta_data ->> 'signup_from' = p_source;
$$;

revoke all on function public.signup_from_stats(text) from public, anon, authenticated;
grant execute on function public.signup_from_stats(text) to service_role;
