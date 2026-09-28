-- Magazzino PRO: categorie gestite. Si scelgono da un menu nel prodotto e
-- se ne crea una nuova al volo con il "+" (popup). Il prodotto conserva il
-- nome della categoria (inventory_products.category), come prima.

create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_inventory_categories_name on public.inventory_categories(owner_id, lower(name));
alter table public.inventory_categories enable row level security;

drop policy if exists inventory_categories_own_select on public.inventory_categories;
create policy inventory_categories_own_select on public.inventory_categories for select to authenticated
  using (owner_id = (select auth.uid()));

-- Categorie già scritte nei prodotti esistenti
insert into public.inventory_categories (owner_id, name)
select distinct on (owner_id, lower(trim(category))) owner_id, trim(category)
from public.inventory_products
where nullif(trim(coalesce(category, '')), '') is not null
on conflict do nothing;

-- Crea una categoria (se esiste già con lo stesso nome, restituisce quella)
create or replace function public.inventory_category_create(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 60);
  v_existing public.inventory_categories%rowtype;
  v_id uuid;
begin
  if not public.inventory_allowed() then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if char_length(v_name) < 1 then
    return jsonb_build_object('error', 'invalid');
  end if;
  select * into v_existing from public.inventory_categories where owner_id = v_uid and lower(name) = lower(v_name);
  if v_existing.id is not null then
    return jsonb_build_object('id', v_existing.id, 'name', v_existing.name, 'existing', true);
  end if;
  if (select count(*) from public.inventory_categories where owner_id = v_uid) >= 200 then
    return jsonb_build_object('error', 'too_many_categories');
  end if;
  insert into public.inventory_categories (owner_id, name) values (v_uid, v_name) returning id into v_id;
  return jsonb_build_object('id', v_id, 'name', v_name);
end;
$$;
revoke all on function public.inventory_category_create(text) from public, anon;
grant execute on function public.inventory_category_create(text) to authenticated;

-- Salvando un prodotto con una categoria scritta a mano, la categoria entra
-- nell'elenco (così resta coerente anche con import o vecchie versioni)
create or replace function public.inventory_products_category_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.category, '')), '') is not null then
    insert into public.inventory_categories (owner_id, name) values (new.owner_id, left(trim(new.category), 60))
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.inventory_products_category_sync() from public, anon, authenticated;
drop trigger if exists inventory_products_category_sync on public.inventory_products;
create trigger inventory_products_category_sync after insert or update of category on public.inventory_products
  for each row execute function public.inventory_products_category_sync();
