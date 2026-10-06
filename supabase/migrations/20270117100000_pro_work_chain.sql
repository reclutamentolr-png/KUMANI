-- Ecosistema, collegamento n. 3: la catena di lavoro del Pro.
--
-- 1. Preventivi ↔ Magazzino: le righe del preventivo possono venire da un
--    prodotto del Magazzino (items[].productId); a lavoro venduto «Scarica
--    dal Magazzino» toglie i prodotti dalla giacenza (vendita, una volta sola,
--    tutto o niente se un prodotto non basta).
-- 2. Menu ↔ Magazzino: un piatto collegato a un prodotto risulta esaurito da
--    solo quando la giacenza arriva a zero e torna disponibile al ricarico.

-- ------------------------------------------------- 1. Preventivo → scarico
alter table public.quotes add column if not exists stock_unloaded_at timestamptz;

-- Restituisce {ok:true, count} oppure {error:'not_allowed'|'not_found'|'already'|
-- 'no_products'|'insufficient', name?, stock?}
create or replace function public.quote_unload_stock(p_quote uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_item jsonb;
  v_product public.inventory_products%rowtype;
  v_qty numeric;
  v_result jsonb;
  v_count int := 0;
begin
  if not public.inventory_allowed() then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  select * into v_quote from public.quotes where id = p_quote and user_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_quote.stock_unloaded_at is not null then
    return jsonb_build_object('error', 'already');
  end if;

  -- Prima si controlla tutto: se un prodotto non basta non si scarica niente
  for v_item in select * from jsonb_array_elements(coalesce(v_quote.items, '[]'::jsonb)) loop
    continue when coalesce(v_item ->> 'productId', '') !~ '^[0-9a-f-]{36}$';
    v_qty := round(coalesce((v_item ->> 'quantity')::numeric, 0), 3);
    continue when v_qty <= 0;
    select * into v_product from public.inventory_products
    where id = (v_item ->> 'productId')::uuid and owner_id = auth.uid() and is_active for update;
    if not found then
      return jsonb_build_object('error', 'insufficient', 'name', coalesce(v_item ->> 'description', ''), 'stock', 0);
    end if;
    if v_product.stock < v_qty then
      return jsonb_build_object('error', 'insufficient', 'name', v_product.name, 'stock', v_product.stock);
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_quote.items, '[]'::jsonb)) loop
    continue when coalesce(v_item ->> 'productId', '') !~ '^[0-9a-f-]{36}$';
    v_qty := round(coalesce((v_item ->> 'quantity')::numeric, 0), 3);
    continue when v_qty <= 0;
    v_result := public.inventory_move((v_item ->> 'productId')::uuid, 'unload', v_qty, 'sale', null,
      nullif(v_item ->> 'unitPrice', '')::numeric, 'Preventivo n. ' || v_quote.quote_number);
    if v_result ? 'error' then
      -- Qualcosa è cambiato nel frattempo: si annulla tutto
      raise exception 'quote_unload_failed: %', v_result ->> 'error';
    end if;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    return jsonb_build_object('error', 'no_products');
  end if;
  update public.quotes set stock_unloaded_at = now() where id = p_quote;
  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;
revoke all on function public.quote_unload_stock(uuid) from public, anon;
grant execute on function public.quote_unload_stock(uuid) to authenticated;

-- ----------------------------------------------------- 2. Menu ↔ Magazzino
alter table public.menu_items
  add column if not exists inventory_product_id uuid references public.inventory_products(id) on delete set null;
create index if not exists menu_items_inventory_product_idx on public.menu_items (inventory_product_id) where inventory_product_id is not null;

-- Si collega solo un prodotto dello stesso titolare del menu
create or replace function public.menu_items_check_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.inventory_product_id is not null and not exists (
    select 1 from public.inventory_products p join public.menus m on m.owner_id = p.owner_id
    where p.id = new.inventory_product_id and m.id = new.menu_id
  ) then
    new.inventory_product_id := null;
  end if;
  -- Appena collegato: disponibile solo se c'è giacenza
  if new.inventory_product_id is not null and (tg_op = 'INSERT' or new.inventory_product_id is distinct from old.inventory_product_id) then
    new.available := coalesce((select stock > 0 from public.inventory_products where id = new.inventory_product_id), new.available);
  end if;
  return new;
end;
$$;
drop trigger if exists menu_items_check_inventory on public.menu_items;
create trigger menu_items_check_inventory
  before insert or update of inventory_product_id, menu_id on public.menu_items
  for each row execute function public.menu_items_check_inventory();

-- Giacenza a zero → piatto esaurito; giacenza di nuovo sopra zero → disponibile
create or replace function public.inventory_sync_menu_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.stock > 0) is distinct from (new.stock > 0) then
    update public.menu_items set available = (new.stock > 0) where inventory_product_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists inventory_sync_menu_availability on public.inventory_products;
create trigger inventory_sync_menu_availability
  after update of stock on public.inventory_products
  for each row execute function public.inventory_sync_menu_availability();
