-- Rifiniture Time Bank e Magazzino PRO:
-- punto KU a entrambe le parti a scambio completato, segnalazioni con regole,
-- codici usati da prodotti archiviati spiegati, eliminazione definitiva.

-- ---------------------------------------------------------------------------
-- Time Bank: punto KU giornaliero a chi dà e a chi riceve
-- ---------------------------------------------------------------------------
create or replace function public.timebank_award_point(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if public.timebank_blocked(p_uid) then
    return;
  end if;
  insert into public.daily_tool_points (user_id, tool_name, awarded_on)
  values (p_uid, 'timebank', (now() at time zone 'Europe/Rome')::date)
  on conflict (user_id, tool_name, awarded_on) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    update public.profiles set daily_points = coalesce(daily_points, 0) + 1, ku_earned_total = coalesce(ku_earned_total, 0) + 1
    where id = p_uid;
  end if;
end;
$$;
revoke all on function public.timebank_award_point(uuid) from public, anon, authenticated;

create or replace function public.timebank_complete(p_exchange uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ex public.timebank_exchanges%rowtype;
begin
  select * into v_ex from public.timebank_exchanges where id = p_exchange for update;
  if v_ex.status not in ('accepted', 'disputed') then
    return;
  end if;
  update public.timebank_exchanges set status = 'completed', completed_at = now(), updated_at = now() where id = p_exchange;
  update public.timebank_profiles set balance = balance + v_ex.hours, hours_given = hours_given + v_ex.hours,
    exchanges_count = exchanges_count + 1, updated_at = now() where user_id = v_ex.giver_id;
  update public.timebank_profiles set balance = balance - v_ex.hours, hours_received = hours_received + v_ex.hours,
    exchanges_count = exchanges_count + 1, updated_at = now() where user_id = v_ex.receiver_id;
  insert into public.timebank_ledger (user_id, exchange_id, amount, kind, note) values
    (v_ex.giver_id, v_ex.id, v_ex.hours, 'exchange', 'Ore date'),
    (v_ex.receiver_id, v_ex.id, -v_ex.hours, 'exchange', 'Ore ricevute');
  perform public.timebank_award_point(v_ex.giver_id);
  perform public.timebank_award_point(v_ex.receiver_id);
end;
$$;
revoke all on function public.timebank_complete(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Time Bank: segnalazioni. Niente segnalazioni di sé stessi, una sola aperta
-- per annuncio/scambio, al massimo 5 al giorno per utente.
-- ---------------------------------------------------------------------------
create index if not exists idx_timebank_reports_reporter on public.timebank_reports(reporter, created_at);

create or replace function public.timebank_report(p_post uuid, p_exchange uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
begin
  if v_uid is null or char_length(trim(coalesce(p_reason, ''))) < 5 then
    return 'invalid';
  end if;
  if public.timebank_blocked(v_uid) then
    return 'not_allowed';
  end if;
  if p_post is not null then
    select user_id into v_target from public.timebank_posts where id = p_post;
  elsif p_exchange is not null then
    select case when giver_id = v_uid then receiver_id else giver_id end into v_target
    from public.timebank_exchanges where id = p_exchange and v_uid in (giver_id, receiver_id);
  end if;
  if v_target is null then
    return 'not_found';
  end if;
  if v_target = v_uid then
    return 'report_own';
  end if;
  -- Un utente alla volta: niente doppioni anche con due invii insieme
  perform pg_advisory_xact_lock(hashtext('timebank_report:' || v_uid::text));
  if exists (select 1 from public.timebank_reports where reporter = v_uid and status = 'open'
             and (p_post is not null and post_id = p_post or p_exchange is not null and exchange_id = p_exchange)) then
    return 'report_already';
  end if;
  if (select count(*) from public.timebank_reports where reporter = v_uid
      and created_at >= (now() at time zone 'Europe/Rome')::date at time zone 'Europe/Rome') >= 5 then
    return 'report_limit';
  end if;
  insert into public.timebank_reports (reporter, target_user, post_id, exchange_id, reason)
  values (v_uid, v_target, p_post, p_exchange, left(trim(p_reason), 1000));
  return 'ok';
end;
$$;
revoke all on function public.timebank_report(uuid, uuid, text) from public, anon;
grant execute on function public.timebank_report(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Magazzino PRO: se lo SKU o il codice a barre è di un prodotto archiviato,
-- si dice quale (per ripristinarlo o eliminarlo)
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
  v_sale numeric := greatest(coalesce((p ->> 'sale_price')::numeric, 0), 0);
  v_min numeric := greatest(coalesce((p ->> 'min_stock')::numeric, 0), 0);
  v_initial numeric := round(greatest(coalesce((p ->> 'initial_stock')::numeric, 0), 0), 3);
  v_sku text := nullif(left(trim(coalesce(p ->> 'sku', '')), 60), '');
  v_barcode text := left(nullif(regexp_replace(coalesce(p ->> 'barcode', ''), '\s', '', 'g'), ''), 64);
  v_other public.inventory_products%rowtype;
  v_constraint text;
begin
  if not public.inventory_allowed() then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if char_length(trim(coalesce(p ->> 'name', ''))) < 1 or v_unit not in ('pz', 'kg', 'g', 'l', 'ml', 'm', 'conf', 'box') then
    return jsonb_build_object('error', 'invalid');
  end if;
  if greatest(v_cost, v_sale, v_min, v_initial) > 1000000 then
    return jsonb_build_object('error', 'number');
  end if;
  if v_sku is not null then
    select * into v_other from public.inventory_products where owner_id = v_uid and lower(sku) = lower(v_sku) and id is distinct from p_id;
    if found then
      return case when v_other.is_active then jsonb_build_object('error', 'sku_taken')
        else jsonb_build_object('error', 'sku_archived', 'product_id', v_other.id, 'product_name', v_other.name) end;
    end if;
  end if;
  if v_barcode is not null then
    select * into v_other from public.inventory_products where owner_id = v_uid and barcode = v_barcode and id is distinct from p_id;
    if found then
      return case when v_other.is_active then jsonb_build_object('error', 'barcode_taken')
        else jsonb_build_object('error', 'barcode_archived', 'product_id', v_other.id, 'product_name', v_other.name) end;
    end if;
  end if;
  begin
    if p_id is null then
      if (select count(*) from public.inventory_products where owner_id = v_uid) >= 3000 then
        return jsonb_build_object('error', 'too_many');
      end if;
      insert into public.inventory_products (owner_id, name, sku, barcode, category, unit, purchase_price, sale_price, min_stock, supplier, notes)
      values (
        v_uid, left(trim(p ->> 'name'), 120), v_sku, v_barcode,
        nullif(left(trim(coalesce(p ->> 'category', '')), 60), ''), v_unit, v_cost, v_sale, v_min,
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
      name = left(trim(p ->> 'name'), 120), sku = v_sku, barcode = v_barcode,
      category = nullif(left(trim(coalesce(p ->> 'category', '')), 60), ''), unit = v_unit, purchase_price = v_cost,
      sale_price = v_sale, min_stock = v_min,
      supplier = nullif(left(trim(coalesce(p ->> 'supplier', '')), 120), ''), notes = nullif(left(trim(coalesce(p ->> 'notes', '')), 500), ''),
      updated_at = now()
    where id = p_id and owner_id = v_uid;
    if not found then
      return jsonb_build_object('error', 'not_found');
    end if;
    return jsonb_build_object('id', p_id);
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    return jsonb_build_object('error', case when v_constraint = 'idx_inventory_products_barcode' then 'barcode_taken' else 'sku_taken' end);
  end;
end;
$$;
revoke all on function public.inventory_product_save(uuid, jsonb) from public, anon;
grant execute on function public.inventory_product_save(uuid, jsonb) to authenticated;

-- Eliminazione definitiva: solo prodotti archiviati, insieme ai loro movimenti
create or replace function public.inventory_product_purge(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.inventory_allowed() then
    return 'not_allowed';
  end if;
  if not exists (select 1 from public.inventory_products where id = p_id and owner_id = auth.uid()) then
    return 'not_found';
  end if;
  delete from public.inventory_products where id = p_id and owner_id = auth.uid() and not is_active;
  return case when found then 'deleted' else 'not_archived' end;
end;
$$;
revoke all on function public.inventory_product_purge(uuid) from public, anon;
grant execute on function public.inventory_product_purge(uuid) to authenticated;
