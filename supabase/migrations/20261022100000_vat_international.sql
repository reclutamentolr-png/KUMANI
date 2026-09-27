-- Partite IVA dei fornitori Kordata anche fuori dall'Italia: si salva paese
-- e numero normalizzato ("IT12345678901", "DE123456789", "CH:CHE123456789").
-- Il formato e la cifra di controllo li controlla il server; la verifica
-- online (VIES, solo UE) la scrive solo il server (client di servizio).

do $$
declare v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.convivio_suppliers'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%vat_number%'
  loop
    execute format('alter table public.convivio_suppliers drop constraint %I', v_name);
  end loop;
end $$;

alter table public.convivio_suppliers add column if not exists vat_country text not null default 'IT';
alter table public.convivio_suppliers add column if not exists vat_status text not null default 'unverified'
  check (vat_status in ('unverified', 'valid', 'invalid'));
alter table public.convivio_suppliers add column if not exists vat_checked_at timestamptz;
alter table public.convivio_suppliers add column if not exists vat_registered_name text;

-- Partite IVA italiane già salvate (solo 11 cifre) → forma con prefisso
update public.convivio_suppliers set vat_number = 'IT' || vat_number, vat_country = 'IT'
where vat_number ~ '^[0-9]{11}$';

alter table public.convivio_suppliers add constraint convivio_suppliers_vat_format
  check (vat_number ~ '^([A-Z]{2}[A-Z0-9+*]{2,20}|[A-Z]{2}:[A-Z0-9]{4,20})$');
alter table public.convivio_suppliers add constraint convivio_suppliers_vat_country
  check (vat_country ~ '^[A-Z]{2}$');

drop function if exists public.convivio_supplier_save(text, text, text, text, text, boolean);
create or replace function public.convivio_supplier_save(
  p_business text, p_vat text, p_city text, p_category text, p_description text, p_accepts boolean,
  p_vat_country text default 'IT'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vat text := upper(regexp_replace(coalesce(p_vat, ''), '[\s.\-/]', '', 'g'));
  v_country text := upper(coalesce(nullif(trim(p_vat_country), ''), 'IT'));
  v_old public.convivio_suppliers%rowtype;
begin
  if auth.uid() is null or public.plan_of(auth.uid()) <> 'pro' then
    return 'not_pro';
  end if;
  if v_country !~ '^[A-Z]{2}$' or v_vat !~ '^([A-Z]{2}[A-Z0-9+*]{2,20}|[A-Z]{2}:[A-Z0-9]{4,20})$' then
    return 'invalid_vat';
  end if;
  if char_length(trim(coalesce(p_business, ''))) < 2 or char_length(trim(coalesce(p_city, ''))) < 2 then
    return 'invalid';
  end if;
  select * into v_old from public.convivio_suppliers where user_id = auth.uid();
  insert into public.convivio_suppliers (user_id, business_name, vat_number, vat_country, city, category, description, accepts_group_orders)
  values (auth.uid(), left(trim(p_business), 120), v_vat, v_country, left(trim(p_city), 80),
          case when p_category in ('food', 'tech', 'travel', 'energy', 'other') then p_category else 'other' end,
          left(trim(coalesce(p_description, '')), 500), coalesce(p_accepts, true))
  on conflict (user_id) do update set
    business_name = excluded.business_name, vat_number = excluded.vat_number, vat_country = excluded.vat_country,
    city = excluded.city, category = excluded.category, description = excluded.description,
    accepts_group_orders = excluded.accepts_group_orders, updated_at = now(),
    -- Numero cambiato: la verifica precedente non vale più
    vat_status = case when v_old.vat_number is distinct from excluded.vat_number then 'unverified' else convivio_suppliers.vat_status end,
    vat_checked_at = case when v_old.vat_number is distinct from excluded.vat_number then null else convivio_suppliers.vat_checked_at end,
    vat_registered_name = case when v_old.vat_number is distinct from excluded.vat_number then null else convivio_suppliers.vat_registered_name end;
  return 'ok';
end;
$$;
revoke all on function public.convivio_supplier_save(text, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.convivio_supplier_save(text, text, text, text, text, boolean, text) to authenticated;
