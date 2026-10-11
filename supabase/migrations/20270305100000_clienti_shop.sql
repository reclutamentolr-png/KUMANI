-- KUMANI PRO «Clienti e Lavori» (fase 5): i clienti dello Shop arrivano da
-- soli. Quando un ordine risulta pagato, il cliente del venditore viene
-- trovato (stessa email, o stesso nome) o creato, e l'ordine resta collegato
-- alla sua scheda. Solo per chi ha Clienti e Lavori nel piano; un errore qui
-- non deve mai bloccare l'ordine.

alter table public.shop_orders add column if not exists client_id uuid references public.quote_clients(id) on delete set null;
create index if not exists shop_orders_client_idx on public.shop_orders (client_id) where client_id is not null;

create or replace function public.shop_order_link_client(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  v_client uuid;
begin
  select id, owner_id, customer_name, customer_email, customer_phone, client_id, paid_at
    into o from public.shop_orders where id = p_order;
  if o.id is null or o.paid_at is null or o.client_id is not null then
    return;
  end if;
  if not exists (select 1 from public.tool_access(o.owner_id, 'clienti') x where x.allowed) then
    return;
  end if;

  select id into v_client from public.quote_clients
   where user_id = o.owner_id and email is not null and lower(email) = lower(o.customer_email)
   order by created_at limit 1;
  if v_client is null then
    select id into v_client from public.quote_clients
     where user_id = o.owner_id and lower(trim(name)) = lower(trim(o.customer_name))
     order by created_at limit 1;
  end if;

  if v_client is null then
    insert into public.quote_clients (user_id, name, email, phone)
    values (o.owner_id, left(trim(o.customer_name), 200), left(o.customer_email, 200), left(o.customer_phone, 60))
    returning id into v_client;
  else
    -- Completa i contatti mancanti senza sovrascrivere quelli già scritti
    update public.quote_clients
       set email = coalesce(email, left(o.customer_email, 200)),
           phone = coalesce(phone, left(o.customer_phone, 60))
     where id = v_client;
  end if;

  update public.shop_orders set client_id = v_client where id = o.id;
exception when others then
  -- Mai bloccare un ordine per il collegamento al cliente
  return;
end;
$$;
revoke all on function public.shop_order_link_client(uuid) from public, anon, authenticated;

create or replace function public.shop_orders_client_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.paid_at is not null and new.client_id is null and (tg_op = 'INSERT' or old.paid_at is null) then
    perform public.shop_order_link_client(new.id);
  end if;
  return null;
end;
$$;
revoke all on function public.shop_orders_client_trigger() from public, anon, authenticated;

drop trigger if exists shop_orders_client on public.shop_orders;
create trigger shop_orders_client after insert or update of paid_at on public.shop_orders
  for each row execute function public.shop_orders_client_trigger();

-- Ordini già pagati
do $$
declare
  r record;
begin
  for r in select id from public.shop_orders where paid_at is not null and client_id is null loop
    perform public.shop_order_link_client(r.id);
  end loop;
end;
$$;
