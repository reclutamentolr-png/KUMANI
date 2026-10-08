-- KUMANI Casa: fino a 3 case per persona (prima 5). Le case già create
-- restano; il limite vale per le nuove.
create or replace function public.casa_limits_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'casa_homes' and (select count(*) from public.casa_homes where user_id = new.user_id) >= 3 then
    raise exception 'casa_homes_limit';
  end if;
  if tg_table_name = 'casa_utilities' and (select count(*) from public.casa_utilities where user_id = new.user_id) >= 50 then
    raise exception 'casa_utilities_limit';
  end if;
  if tg_table_name = 'casa_appliances' and (select count(*) from public.casa_appliances where user_id = new.user_id) >= 200 then
    raise exception 'casa_appliances_limit';
  end if;
  if tg_table_name = 'casa_documents' and (select count(*) from public.casa_documents where user_id = new.user_id) >= 300 then
    raise exception 'casa_documents_limit';
  end if;
  return new;
end;
$$;
revoke all on function public.casa_limits_check() from public, anon, authenticated;
