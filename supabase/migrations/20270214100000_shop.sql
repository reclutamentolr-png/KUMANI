-- KUMANI Shop, fase 2: il negozio online del professionista (piano Pro).
-- Prodotti nuovi o presi dal Magazzino, pagina pubblica /shop/<nome> con
-- carrello, acquisto anche senza registrazione, pagamento con Stripe sul
-- conto del venditore (come i preventivi della fase 1), spedizione a costo
-- fisso (Italia ed eventualmente Europa, gratis sopra una soglia) oppure
-- ritiro, ordini con stato e numero di tracciamento. Quando il pagamento
-- arriva la giacenza scende da sola (anche quella del Magazzino).

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('shop', true, 'pro', 'KUMANI Shop – negozio online con carrello, pagamento con Stripe, spedizione o ritiro e ordini')
on conflict (tool_name) do nothing;

-- Negozio: uno per persona
create table if not exists public.shop_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 600),
  cover_path text,
  is_open boolean not null default false,
  pickup_enabled boolean not null default true,
  pickup_info text not null default '' check (char_length(pickup_info) <= 300),
  shipping_enabled boolean not null default false,
  shipping_it_cents integer not null default 690 check (shipping_it_cents between 0 and 100000),
  shipping_eu_cents integer check (shipping_eu_cents is null or shipping_eu_cents between 0 and 100000),
  free_shipping_over_cents integer check (free_shipping_over_cents is null or free_shipping_over_cents between 0 and 10000000),
  returns_policy text not null default '' check (char_length(returns_policy) <= 2000),
  last_order_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1500),
  price_cents integer not null check (price_cents between 50 and 10000000),
  image_path text,
  -- Collegato al Magazzino: la disponibilità è la giacenza del Magazzino
  inventory_product_id uuid references public.inventory_products(id) on delete set null,
  -- Non collegato: pezzi disponibili (null = senza limite)
  stock integer check (stock is null or stock >= 0),
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_products_owner_idx on public.shop_products (owner_id, position, created_at);
create unique index if not exists shop_products_inventory_idx on public.shop_products (owner_id, inventory_product_id) where inventory_product_id is not null;

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  number integer,
  public_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'ready', 'shipped', 'delivered', 'cancelled')),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text not null check (char_length(customer_email) between 5 and 200),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 40),
  delivery text not null check (delivery in ('pickup', 'shipping')),
  ship_address jsonb,
  notes text check (notes is null or char_length(notes) <= 500),
  items jsonb not null,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  fee_cents integer not null default 0,
  locale text,
  stripe_session_id text unique,
  stripe_payment_intent text,
  tracking_number text check (tracking_number is null or char_length(tracking_number) <= 80),
  tracking_url text check (tracking_url is null or char_length(tracking_url) <= 500),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);
create index if not exists shop_orders_owner_idx on public.shop_orders (owner_id, created_at desc);
create unique index if not exists shop_orders_number_idx on public.shop_orders (owner_id, number) where number is not null;

-- Regole: ognuno gestisce solo il suo negozio e i suoi prodotti; gli ordini
-- li legge e basta (stato e spedizione passano dal server, che controlla).
-- La pagina pubblica legge dal server, dopo aver controllato che il
-- negozio sia aperto e il piano attivo.
alter table public.shop_settings enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;

drop policy if exists shop_settings_own on public.shop_settings;
create policy shop_settings_own on public.shop_settings for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists shop_products_own on public.shop_products;
create policy shop_products_own on public.shop_products for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (inventory_product_id is null or exists (select 1 from public.inventory_products p where p.id = inventory_product_id and p.owner_id = (select auth.uid())))
  );
drop policy if exists shop_orders_own_read on public.shop_orders;
create policy shop_orders_own_read on public.shop_orders for select to authenticated
  using (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.shop_settings, public.shop_products to authenticated;
grant select on public.shop_orders to authenticated;

-- Il numero degli ordini lo decide solo il server
create or replace function public.shop_settings_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.last_order_number := 0;
  else
    new.last_order_number := old.last_order_number;
    new.owner_id := old.owner_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists shop_settings_guard on public.shop_settings;
create trigger shop_settings_guard before insert or update on public.shop_settings
  for each row execute function public.shop_settings_guard();

-- Pagamento arrivato: ordine pagato con il suo numero, giacenze scalate
-- (Magazzino: movimento di scarico «vendita»). Una volta sola.
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
  v_stock numeric;
  v_number integer;
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
    if v_product.inventory_product_id is not null then
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
      update public.shop_products set stock = greatest(stock - v_qty, 0), updated_at = now() where id = v_product.id;
    end if;
  end loop;

  update public.shop_orders
  set status = 'paid', number = v_number, paid_at = now(),
      stripe_session_id = coalesce(p_session, stripe_session_id),
      stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent)
  where id = p_order;
  return v_number;
end;
$$;
revoke all on function public.shop_mark_order_paid(uuid, text, text) from public, anon, authenticated;
grant execute on function public.shop_mark_order_paid(uuid, text, text) to service_role;

-- Pulizia: i carrelli mai pagati dopo 3 giorni
create or replace function public.shop_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.shop_orders where status = 'pending' and created_at < now() - interval '3 days';
$$;
revoke all on function public.shop_cleanup() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'kumani-shop-cleanup';
  perform cron.schedule('kumani-shop-cleanup', '20 4 * * *', 'select public.shop_cleanup()');
end;
$$;

-- Foto dei prodotti e copertina: pubbliche (pagina del negozio), ognuno
-- scrive solo nella sua cartella
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-media', 'shop-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists shop_media_insert on storage.objects;
create policy shop_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists shop_media_update on storage.objects;
create policy shop_media_update on storage.objects for update to authenticated
  using (bucket_id = 'shop-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists shop_media_delete on storage.objects;
create policy shop_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'shop-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Limiti (Admin → Limiti e pulizia)
insert into public.app_limits (key, value, kind, section, label, sort) values
  ('shop_products', 300, 'count', 'KUMANI Shop', 'Prodotti del negozio per persona', 160),
  ('files_shop-media', 400, 'files', 'File per persona', 'Foto dei prodotti del negozio', 208)
on conflict (key) do nothing;
drop trigger if exists app_limit_check on public.shop_products;
create trigger app_limit_check before insert on public.shop_products
  for each row execute function public.enforce_app_limit('shop_products', 'owner_id');
