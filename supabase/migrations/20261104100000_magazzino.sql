-- Magazzino PRO (piano Pro, categoria Lavoro): prodotti, giacenze,
-- movimenti, inventario, cruscotto ed export per il commercialista.
--
-- Rispetto a una tabella "stock" aggiornata da un trigger semplice:
--   - ogni movimento passa da inventory_move(): controlla proprietario e
--     piano, blocca la riga del prodotto (due dispositivi insieme non
--     sbagliano i conti) e non lascia scaricare più di quanto c'è;
--   - l'inventario è una rettifica (si scrive la quantità contata, si
--     registra la differenza);
--   - i carichi con prezzo aggiornano il costo medio ponderato, così valore
--     del magazzino e margini sono corretti;
--   - lo storico è immutabile (niente modifiche o cancellazioni dei
--     movimenti: un errore si corregge con un movimento opposto).

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('magazzino', true, 'pro', 'Magazzino PRO – prodotti, giacenze, movimenti, inventario ed export per il commercialista')
on conflict (tool_name) do nothing;

create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sku text check (sku is null or char_length(sku) <= 60),
  barcode text check (barcode is null or char_length(barcode) <= 64),
  category text check (category is null or char_length(category) <= 60),
  unit text not null default 'pz' check (unit in ('pz', 'kg', 'g', 'l', 'ml', 'm', 'conf', 'box')),
  purchase_price numeric(12, 4) not null default 0 check (purchase_price >= 0),
  sale_price numeric(12, 2) not null default 0 check (sale_price >= 0),
  stock numeric(14, 3) not null default 0 check (stock >= 0),
  min_stock numeric(14, 3) not null default 0 check (min_stock >= 0),
  supplier text check (supplier is null or char_length(supplier) <= 120),
  notes text check (notes is null or char_length(notes) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inventory_products_owner on public.inventory_products(owner_id, is_active, name);
create unique index if not exists idx_inventory_products_sku on public.inventory_products(owner_id, lower(sku)) where sku is not null;
create unique index if not exists idx_inventory_products_barcode on public.inventory_products(owner_id, barcode) where barcode is not null;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  type text not null check (type in ('load', 'unload', 'adjust')),
  -- Carico/scarico: quantità positiva. Rettifica: differenza (+/-).
  quantity numeric(14, 3) not null,
  stock_after numeric(14, 3) not null,
  unit_cost numeric(12, 4) check (unit_cost is null or unit_cost >= 0),
  unit_price numeric(12, 2) check (unit_price is null or unit_price >= 0),
  reason text not null check (reason in ('purchase', 'sale', 'return', 'gift', 'waste', 'inventory', 'other')),
  notes text check (notes is null or char_length(notes) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists idx_inventory_movements_owner on public.inventory_movements(owner_id, created_at desc);
create index if not exists idx_inventory_movements_product on public.inventory_movements(product_id, created_at desc);

alter table public.inventory_products enable row level security;
alter table public.inventory_movements enable row level security;

-- Lettura diretta solo dei propri dati; tutte le scritture dalle funzioni.
drop policy if exists inventory_products_own_select on public.inventory_products;
create policy inventory_products_own_select on public.inventory_products for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists inventory_movements_own_select on public.inventory_movements;
create policy inventory_movements_own_select on public.inventory_movements for select to authenticated
  using (owner_id = (select auth.uid()));

create or replace function public.inventory_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from public.can_use_tool('magazzino') t where t.allowed);
$$;
revoke all on function public.inventory_allowed() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prodotti
-- ---------------------------------------------------------------------------
create or replace function public.inventory_product_save(p_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_unit text := coalesce(p ->> 'unit', 'pz');
  v_cost numeric := greatest(coalesce((p ->> 'purchase_price')::numeric, 0), 0);
  v_initial numeric := greatest(coalesce((p ->> 'initial_stock')::numeric, 0), 0);
  v_sku text := nullif(left(trim(coalesce(p ->> 'sku', '')), 60), '');
  v_barcode text := nullif(regexp_replace(coalesce(p ->> 'barcode', ''), '\s', '', 'g'), '');
begin
  if not public.inventory_allowed() then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if char_length(trim(coalesce(p ->> 'name', ''))) < 1 or v_unit not in ('pz', 'kg', 'g', 'l', 'ml', 'm', 'conf', 'box') then
    return jsonb_build_object('error', 'invalid');
  end if;
  if v_sku is not null and exists (select 1 from public.inventory_products where owner_id = v_uid and lower(sku) = lower(v_sku) and id is distinct from p_id) then
    return jsonb_build_object('error', 'sku_taken');
  end if;
  if v_barcode is not null and exists (select 1 from public.inventory_products where owner_id = v_uid and barcode = left(v_barcode, 64) and id is distinct from p_id) then
    return jsonb_build_object('error', 'barcode_taken');
  end if;
  if p_id is null then
    if (select count(*) from public.inventory_products where owner_id = v_uid) >= 3000 then
      return jsonb_build_object('error', 'too_many');
    end if;
    insert into public.inventory_products (owner_id, name, sku, barcode, category, unit, purchase_price, sale_price, min_stock, supplier, notes)
    values (
      v_uid, left(trim(p ->> 'name'), 120), v_sku, left(v_barcode, 64),
      nullif(left(trim(coalesce(p ->> 'category', '')), 60), ''), v_unit, v_cost,
      greatest(coalesce((p ->> 'sale_price')::numeric, 0), 0), greatest(coalesce((p ->> 'min_stock')::numeric, 0), 0),
      nullif(left(trim(coalesce(p ->> 'supplier', '')), 120), ''), nullif(left(trim(coalesce(p ->> 'notes', '')), 500), '')
    ) returning id into v_id;
    -- Giacenza iniziale: primo carico "inventario" al costo indicato
    if v_initial > 0 then
      update public.inventory_products set stock = v_initial where id = v_id;
      insert into public.inventory_movements (owner_id, product_id, type, quantity, stock_after, unit_cost, reason, notes)
      values (v_uid, v_id, 'load', v_initial, v_initial, v_cost, 'inventory', 'Giacenza iniziale');
    end if;
    return jsonb_build_object('id', v_id);
  end if;
  -- Modifica: la giacenza cambia solo con i movimenti; il costo medio si
  -- può correggere a mano (es. listino sbagliato)
  update public.inventory_products set
    name = left(trim(p ->> 'name'), 120), sku = v_sku, barcode = left(v_barcode, 64),
    category = nullif(left(trim(coalesce(p ->> 'category', '')), 60), ''), unit = v_unit, purchase_price = v_cost,
    sale_price = greatest(coalesce((p ->> 'sale_price')::numeric, 0), 0), min_stock = greatest(coalesce((p ->> 'min_stock')::numeric, 0), 0),
    supplier = nullif(left(trim(coalesce(p ->> 'supplier', '')), 120), ''), notes = nullif(left(trim(coalesce(p ->> 'notes', '')), 500), ''),
    updated_at = now()
  where id = p_id and owner_id = v_uid;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  return jsonb_build_object('id', p_id);
end;
$$;
revoke all on function public.inventory_product_save(uuid, jsonb) from public, anon;
grant execute on function public.inventory_product_save(uuid, jsonb) to authenticated;

-- Eliminare: solo se non ha movimenti; altrimenti si archivia (lo storico resta)
create or replace function public.inventory_product_remove(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.inventory_allowed() then
    return 'not_allowed';
  end if;
  if exists (select 1 from public.inventory_movements where product_id = p_id) then
    update public.inventory_products set is_active = false, updated_at = now() where id = p_id and owner_id = auth.uid();
    return case when found then 'archived' else 'not_found' end;
  end if;
  delete from public.inventory_products where id = p_id and owner_id = auth.uid();
  return case when found then 'deleted' else 'not_found' end;
end;
$$;
revoke all on function public.inventory_product_remove(uuid) from public, anon;
grant execute on function public.inventory_product_remove(uuid) to authenticated;

create or replace function public.inventory_product_restore(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.inventory_allowed() then
    return 'not_allowed';
  end if;
  update public.inventory_products set is_active = true, updated_at = now() where id = p_id and owner_id = auth.uid();
  return case when found then 'ok' else 'not_found' end;
end;
$$;
revoke all on function public.inventory_product_restore(uuid) from public, anon;
grant execute on function public.inventory_product_restore(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Movimenti
-- ---------------------------------------------------------------------------
-- p_type: load (carico) · unload (scarico) · adjust (inventario: p_quantity
-- è la quantità contata). Costo medio ponderato sui carichi con prezzo.
create or replace function public.inventory_move(
  p_product uuid, p_type text, p_quantity numeric, p_reason text, p_unit_cost numeric, p_unit_price numeric, p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.inventory_products%rowtype;
  v_qty numeric := round(coalesce(p_quantity, 0), 3);
  v_delta numeric;
  v_after numeric;
  v_cost numeric;
begin
  if not public.inventory_allowed() then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  select * into v_product from public.inventory_products where id = p_product and owner_id = v_uid for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if p_type = 'load' and p_reason not in ('purchase', 'return', 'inventory', 'other')
     or p_type = 'unload' and p_reason not in ('sale', 'gift', 'waste', 'return', 'other')
     or p_type = 'adjust' and p_reason <> 'inventory'
     or p_type not in ('load', 'unload', 'adjust') then
    return jsonb_build_object('error', 'invalid');
  end if;
  if p_type in ('load', 'unload') and (v_qty <= 0 or v_qty > 1000000) then
    return jsonb_build_object('error', 'quantity');
  end if;
  if p_type = 'adjust' and (v_qty < 0 or v_qty > 1000000) then
    return jsonb_build_object('error', 'quantity');
  end if;

  v_cost := v_product.purchase_price;
  if p_type = 'load' then
    v_delta := v_qty;
    -- Costo medio ponderato (solo carichi di merce con prezzo)
    if p_unit_cost is not null and p_unit_cost >= 0 and p_reason in ('purchase', 'inventory') and v_product.stock + v_qty > 0 then
      v_cost := round((v_product.stock * v_product.purchase_price + v_qty * p_unit_cost) / (v_product.stock + v_qty), 4);
    end if;
  elsif p_type = 'unload' then
    if v_qty > v_product.stock then
      return jsonb_build_object('error', 'insufficient', 'stock', v_product.stock);
    end if;
    v_delta := -v_qty;
  else
    v_delta := v_qty - v_product.stock;
    if v_delta = 0 then
      return jsonb_build_object('error', 'no_change');
    end if;
  end if;
  v_after := v_product.stock + v_delta;

  update public.inventory_products set stock = v_after, purchase_price = v_cost, updated_at = now() where id = p_product;
  insert into public.inventory_movements (owner_id, product_id, type, quantity, stock_after, unit_cost, unit_price, reason, notes)
  values (
    v_uid, p_product, p_type, case when p_type = 'adjust' then v_delta else v_qty end, v_after,
    case when p_type = 'load' and p_unit_cost is not null and p_unit_cost >= 0 then round(p_unit_cost, 4) else null end,
    case when p_type = 'unload' and p_unit_price is not null and p_unit_price >= 0 then round(p_unit_price, 2) else null end,
    p_reason, nullif(left(trim(coalesce(p_notes, '')), 300), '')
  );
  return jsonb_build_object('stock', v_after, 'purchase_price', v_cost);
end;
$$;
revoke all on function public.inventory_move(uuid, text, numeric, text, numeric, numeric, text) from public, anon;
grant execute on function public.inventory_move(uuid, text, numeric, text, numeric, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cruscotto
-- ---------------------------------------------------------------------------
create or replace function public.inventory_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (select * from public.inventory_products where owner_id = auth.uid() and is_active),
  m as (select * from public.inventory_movements where owner_id = auth.uid() and created_at > now() - interval '30 days')
  select jsonb_build_object(
    'products', (select count(*) from p),
    'stock_value', coalesce((select round(sum(stock * purchase_price), 2) from p), 0),
    'sale_value', coalesce((select round(sum(stock * sale_price), 2) from p), 0),
    'below_min', (select count(*) from p where min_stock > 0 and stock <= min_stock),
    'movements_month', (select count(*) from public.inventory_movements
                        where owner_id = auth.uid() and created_at >= date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'),
    -- Margine medio: (vendita - costo) / vendita sui prodotti con entrambi i prezzi
    'avg_margin', (select round(avg((sale_price - purchase_price) / sale_price) * 100, 1) from p where sale_price > 0 and purchase_price > 0),
    'reorder', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock, 'min_stock', min_stock, 'unit', unit, 'supplier', supplier)
                                           order by (stock / nullif(min_stock, 0)), name)
                         from p where min_stock > 0 and stock <= min_stock), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(t.x order by t.moves desc) from (
                      select jsonb_build_object('id', p.id, 'name', p.name, 'unit', p.unit, 'moves', count(m.id),
                                                'out', coalesce(sum(case when m.type = 'unload' then m.quantity end), 0)) as x,
                             count(m.id) as moves
                      from p join m on m.product_id = p.id group by p.id, p.name, p.unit order by count(m.id) desc limit 10) t), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'loads', d.loads, 'unloads', d.unloads) order by d.day) from (
                        select g.day::date as day,
                               (select count(*) from m where m.type = 'load' and (m.created_at at time zone 'Europe/Rome')::date = g.day::date) as loads,
                               (select count(*) from m where m.type = 'unload' and (m.created_at at time zone 'Europe/Rome')::date = g.day::date) as unloads
                        from generate_series((now() at time zone 'Europe/Rome')::date - 29, (now() at time zone 'Europe/Rome')::date, interval '1 day') g(day)) d), '[]'::jsonb)
  );
$$;
revoke all on function public.inventory_dashboard() from public, anon;
grant execute on function public.inventory_dashboard() to authenticated;

-- Cancellazione account (GDPR): anche il magazzino
create or replace function public.profiles_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fidelity_members where user_id = new.id;
  delete from public.trip_exits where user_id = new.id;
  update public.veritas_players set nickname = 'Kumano' where user_id = new.id;
  delete from public.svat_qc_reports where user_id = new.id;
  delete from public.timebank_posts where user_id = new.id;
  delete from public.timebank_profiles where user_id = new.id;
  delete from public.timebank_messages where sender_id = new.id;
  delete from public.inventory_products where owner_id = new.id;
  return new;
end;
$$;

-- Punti KU giornalieri anche per Magazzino PRO
CREATE OR REPLACE FUNCTION public.award_tool_point(p_tool_name text)
 RETURNS TABLE(awarded boolean, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_rows int;
  v_balance int;
begin
  if auth.uid() is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino'
  ) then
    return;
  end if;

  -- Niente punti per strumenti non inclusi nel piano (evita di raccogliere
  -- KU chiamando la funzione direttamente senza usare lo strumento).
  if not exists (select 1 from public.tool_access(auth.uid(), p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (auth.uid(), p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + 1,
      ku_earned_total = coalesce(ku_earned_total, 0) + 1
  where id = auth.uid()
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;
