-- KUMANI Shop: niente vendite oltre la giacenza.
-- 1) Prenotazione: quando il cliente va al pagamento i pezzi restano da parte
--    per 35 minuti (la pagina di pagamento Stripe dura 31 minuti); gli altri
--    vedono solo quelli liberi. Se il cliente torna indietro si liberano subito.
-- 2) Avviso: se al pagamento i pezzi non bastano comunque (pagamento arrivato
--    a prenotazione scaduta), l'ordine segna cosa manca e il venditore lo vede.

alter table public.shop_orders add column if not exists reserved_until timestamptz;
alter table public.shop_orders add column if not exists stock_short jsonb;

create index if not exists shop_orders_reserved_idx on public.shop_orders (owner_id, reserved_until) where status = 'pending';

-- Pezzi prenotati da ordini in attesa di pagamento, per prodotto
create or replace function public.shop_reserved(p_owner uuid, p_exclude uuid default null)
returns table (product_id uuid, quantity integer)
language sql
stable
security definer
set search_path = public
as $$
  select (i ->> 'product_id')::uuid, sum(greatest((i ->> 'quantity')::integer, 0))::integer
  from public.shop_orders o, jsonb_array_elements(o.items) i
  where o.owner_id = p_owner
    and o.status = 'pending'
    and o.reserved_until > now()
    and (p_exclude is null or o.id <> p_exclude)
  group by 1;
$$;
revoke all on function public.shop_reserved(uuid, uuid) from public, anon, authenticated;
grant execute on function public.shop_reserved(uuid, uuid) to service_role;

-- Prenota i pezzi di un ordine appena creato. I prodotti vengono bloccati uno
-- per volta (sempre nello stesso ordine), così due clienti che comprano
-- l'ultimo pezzo nello stesso momento passano uno dopo l'altro: il secondo
-- trova il pezzo già prenotato. Se non basta, l'ordine viene cancellato.
create or replace function public.shop_reserve_order(p_order uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_line record;
  v_product record;
  v_stock numeric;
  v_taken integer;
begin
  select * into v_order from public.shop_orders where id = p_order for update;
  if not found or v_order.status <> 'pending' then
    return false;
  end if;

  for v_line in
    select (i ->> 'product_id')::uuid as product_id, sum(greatest((i ->> 'quantity')::integer, 0))::integer as qty
    from jsonb_array_elements(v_order.items) i
    group by 1
    order by 1
  loop
    select id, inventory_product_id, stock into v_product
    from public.shop_products where id = v_line.product_id and owner_id = v_order.owner_id
    for update;
    if not found then
      delete from public.shop_orders where id = p_order;
      return false;
    end if;
    if v_product.inventory_product_id is not null then
      select stock into v_stock from public.inventory_products
      where id = v_product.inventory_product_id and owner_id = v_order.owner_id;
      v_stock := coalesce(v_stock, 0);
    else
      v_stock := v_product.stock;
    end if;
    if v_stock is null then
      continue; -- disponibilità illimitata
    end if;
    select coalesce(sum(r.quantity), 0) into v_taken from public.shop_reserved(v_order.owner_id, p_order) r where r.product_id = v_line.product_id;
    if floor(v_stock) - v_taken < v_line.qty then
      delete from public.shop_orders where id = p_order;
      return false;
    end if;
  end loop;

  update public.shop_orders set reserved_until = now() + interval '35 minutes' where id = p_order;
  return true;
end;
$$;
revoke all on function public.shop_reserve_order(uuid) from public, anon, authenticated;
grant execute on function public.shop_reserve_order(uuid) to service_role;

-- Pagamento arrivato: come prima (numero, giacenze scalate), in più annota i
-- pezzi che mancavano al momento del pagamento.
create or replace function public.shop_mark_order_paid(p_order uuid, p_session text, p_payment_intent text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_item jsonb;
  v_qty integer;
  v_product record;
  v_before numeric;
  v_stock numeric;
  v_number integer;
  v_short jsonb := '[]'::jsonb;
begin
  select * into v_order from public.shop_orders where id = p_order for update;
  if not found then
    return null;
  end if;
  if v_order.status <> 'pending' then
    return v_order.number;
  end if;

  update public.shop_settings set last_order_number = last_order_number + 1
  where owner_id = v_order.owner_id
  returning last_order_number into v_number;

  for v_item in select * from jsonb_array_elements(v_order.items) loop
    v_qty := greatest((v_item ->> 'quantity')::integer, 0);
    select id, inventory_product_id, stock into v_product
    from public.shop_products where id = (v_item ->> 'product_id')::uuid and owner_id = v_order.owner_id
    for update;
    if not found or v_qty = 0 then
      continue;
    end if;
    v_before := null;
    if v_product.inventory_product_id is not null then
      select stock into v_before from public.inventory_products
      where id = v_product.inventory_product_id and owner_id = v_order.owner_id
      for update;
      update public.inventory_products
      set stock = greatest(stock - v_qty, 0), updated_at = now()
      where id = v_product.inventory_product_id and owner_id = v_order.owner_id
      returning stock into v_stock;
      if found then
        insert into public.inventory_movements (owner_id, product_id, type, quantity, stock_after, unit_price, reason, notes)
        values (v_order.owner_id, v_product.inventory_product_id, 'unload', v_qty, v_stock, ((v_item ->> 'price_cents')::numeric / 100), 'sale',
                left('KUMANI Shop · ordine n. ' || coalesce(v_number, 0), 300));
      end if;
    elsif v_product.stock is not null then
      v_before := v_product.stock;
      update public.shop_products set stock = greatest(stock - v_qty, 0), updated_at = now() where id = v_product.id;
    end if;
    if v_before is not null and floor(v_before) < v_qty then
      v_short := v_short || jsonb_build_object('name', v_item ->> 'name', 'missing', v_qty - greatest(floor(v_before), 0)::integer);
    end if;
  end loop;

  update public.shop_orders
  set status = 'paid', number = v_number, paid_at = now(),
      stock_short = case when jsonb_array_length(v_short) > 0 then v_short else null end,
      stripe_session_id = coalesce(p_session, stripe_session_id),
      stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent)
  where id = p_order;
  return v_number;
end;
$$;
revoke all on function public.shop_mark_order_paid(uuid, text, text) from public, anon, authenticated;
grant execute on function public.shop_mark_order_paid(uuid, text, text) to service_role;
