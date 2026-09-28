-- Correzioni dopo il controllo di Time Bank e Magazzino PRO:
-- bonus di benvenuto una sola volta anche con due invii insieme, limiti di
-- saldo e ore rispettati anche con accettazioni contemporanee, decisione
-- dello Staff sicura, utenti bloccati fermi, prodotti archiviati non movibili,
-- cancellazione account completa.

-- ---------------------------------------------------------------------------
-- Time Bank
-- ---------------------------------------------------------------------------

-- Un valore non numerico scritto per errore in Admin non deve bloccare il servizio
create or replace function public.tb_num(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when trim(coalesce(public.setting_text(p_key), '')) ~ '^-?\d+(\.\d+)?$'
              then trim(public.setting_text(p_key))::numeric else p_default end;
$$;
revoke all on function public.tb_num(text, numeric) from public, anon, authenticated;

-- Bloccato o account cancellato: non può più confermare, contestare o scrivere
create or replace function public.timebank_blocked(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select coalesce(is_blocked, false) or deleted_at is not null from public.profiles where id = p_uid), true);
$$;
revoke all on function public.timebank_blocked(uuid) from public, anon, authenticated;

-- Credito di benvenuto: lo decide l'inserimento stesso (niente doppio bonus)
create or replace function public.timebank_save_profile(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new boolean;
  v_welcome numeric := public.tb_num('timebank_welcome_hours', 2);
  v_offers text[] := public.timebank_clean_array(p -> 'offers', public.timebank_categories());
  v_seeks text[] := public.timebank_clean_array(p -> 'seeks', public.timebank_categories());
  v_bio text := nullif(left(trim(coalesce(p ->> 'bio', '')), 500), '');
  v_city text := nullif(left(trim(coalesce(p ->> 'city', '')), 80), '');
  v_country text := nullif(upper(coalesce(p ->> 'country_code', '')), '');
  v_in_person boolean := coalesce((p ->> 'in_person')::boolean, true);
  v_online boolean := coalesce((p ->> 'online')::boolean, true);
  v_languages text[] := public.timebank_clean_array(p -> 'languages', array['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']);
  v_availability text := nullif(left(trim(coalesce(p ->> 'availability', '')), 120), '');
begin
  perform public.tool_require_online('timebank');
  if v_uid is null or not public.timebank_is_verified(v_uid) then
    return 'not_verified';
  end if;
  insert into public.timebank_profiles (user_id, offers, seeks, bio, city, country_code, in_person, online, languages, availability)
  values (v_uid, v_offers, v_seeks, v_bio, v_city, v_country, v_in_person, v_online, v_languages, v_availability)
  on conflict (user_id) do nothing
  returning true into v_new;
  if v_new then
    -- Benvenuto: credito iniziale (una volta sola)
    if v_welcome > 0 then
      update public.timebank_profiles set balance = balance + v_welcome where user_id = v_uid;
      insert into public.timebank_ledger (user_id, amount, kind, note) values (v_uid, v_welcome, 'welcome', 'Credito di benvenuto');
    end if;
  else
    update public.timebank_profiles set
      offers = v_offers, seeks = v_seeks, bio = v_bio, city = v_city, country_code = v_country, in_person = v_in_person,
      online = v_online, languages = v_languages, availability = v_availability, updated_at = now()
    where user_id = v_uid;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.timebank_save_profile(jsonb) from public, anon;
grant execute on function public.timebank_save_profile(jsonb) to authenticated;

-- Limiti: il saldo massimo conta anche le ore già in arrivo; senza data il
-- giorno è quello della proposta (come nel conteggio)
create or replace function public.timebank_check_limits(p_giver uuid, p_receiver uuid, p_hours numeric, p_day date, p_exclude uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_receiver_balance numeric;
  v_receiver_pending numeric;
  v_giver_balance numeric;
  v_giver_pending numeric;
  v_day date := p_day;
begin
  if v_day is null and p_exclude is not null then
    select (created_at at time zone 'Europe/Rome')::date into v_day from public.timebank_exchanges where id = p_exclude;
  end if;
  v_day := coalesce(v_day, (now() at time zone 'Europe/Rome')::date);

  select balance into v_receiver_balance from public.timebank_profiles where user_id = p_receiver;
  select coalesce(sum(hours), 0) into v_receiver_pending from public.timebank_exchanges
  where receiver_id = p_receiver and status in ('accepted', 'disputed') and id is distinct from p_exclude;
  if coalesce(v_receiver_balance, 0) - v_receiver_pending - p_hours < public.tb_num('timebank_min_balance', -5) then
    return 'receiver_balance';
  end if;
  select balance into v_giver_balance from public.timebank_profiles where user_id = p_giver;
  select coalesce(sum(hours), 0) into v_giver_pending from public.timebank_exchanges
  where giver_id = p_giver and status in ('accepted', 'disputed') and id is distinct from p_exclude;
  if coalesce(v_giver_balance, 0) + v_giver_pending + p_hours > public.tb_num('timebank_max_balance', 40) then
    return 'giver_max';
  end if;
  if (select coalesce(sum(hours), 0) from public.timebank_exchanges
      where giver_id = p_giver and status in ('accepted', 'completed', 'disputed') and id is distinct from p_exclude
        and coalesce(scheduled_on, (created_at at time zone 'Europe/Rome')::date) = v_day) + p_hours > public.tb_num('timebank_max_hours_day', 4) then
    return 'day_limit';
  end if;
  if (select coalesce(sum(hours), 0) from public.timebank_exchanges
      where giver_id = p_giver and receiver_id = p_receiver and status in ('accepted', 'completed', 'disputed') and id is distinct from p_exclude
        and coalesce(scheduled_on, (created_at at time zone 'Europe/Rome')::date) between v_day - 6 and v_day + 6) + p_hours > public.tb_num('timebank_max_pair_week', 4) then
    return 'pair_limit';
  end if;
  return null;
end;
$$;
revoke all on function public.timebank_check_limits(uuid, uuid, numeric, date, uuid) from public, anon, authenticated;

-- Proposta: anche uno scambio contestato sullo stesso annuncio conta come "già in corso"
create or replace function public.timebank_propose(p_post uuid, p_hours numeric, p_note text, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.timebank_posts%rowtype;
  v_giver uuid;
  v_receiver uuid;
  v_hours numeric := round(coalesce(p_hours, 0) * 2) / 2;
  v_problem text;
  v_id uuid;
begin
  perform public.tool_require_online('timebank');
  if v_uid is null or not public.timebank_ready(v_uid) then
    return jsonb_build_object('error', 'not_verified');
  end if;
  select * into v_post from public.timebank_posts where id = p_post and status = 'open';
  if not found then
    return jsonb_build_object('error', 'not_available');
  end if;
  if v_post.user_id = v_uid then
    return jsonb_build_object('error', 'own_post');
  end if;
  if not public.timebank_ready(v_post.user_id) then
    return jsonb_build_object('error', 'not_available');
  end if;
  if v_hours < 0.5 or v_hours > 8 then
    return jsonb_build_object('error', 'hours');
  end if;
  if p_day is not null and (p_day < (now() at time zone 'Europe/Rome')::date or p_day > (now() at time zone 'Europe/Rome')::date + 365) then
    return jsonb_build_object('error', 'date');
  end if;
  if v_post.kind = 'request' then
    v_giver := v_uid; v_receiver := v_post.user_id;
  else
    v_giver := v_post.user_id; v_receiver := v_uid;
  end if;
  if exists (select 1 from public.timebank_exchanges where post_id = p_post and status in ('proposed', 'accepted', 'disputed')
             and v_uid in (giver_id, receiver_id)) then
    return jsonb_build_object('error', 'already');
  end if;
  v_problem := public.timebank_check_limits(v_giver, v_receiver, v_hours, p_day, null);
  if v_problem is not null then
    return jsonb_build_object('error', v_problem);
  end if;
  insert into public.timebank_exchanges (post_id, giver_id, receiver_id, proposed_by, hours, note, scheduled_on)
  values (p_post, v_giver, v_receiver, v_uid, v_hours, nullif(left(trim(coalesce(p_note, '')), 500), ''), p_day)
  returning id into v_id;
  if nullif(trim(coalesce(p_note, '')), '') is not null then
    insert into public.timebank_messages (exchange_id, sender_id, body) values (v_id, v_uid, left(trim(p_note), 1000));
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function public.timebank_propose(uuid, numeric, text, date) from public, anon;
grant execute on function public.timebank_propose(uuid, numeric, text, date) to authenticated;

-- Accettare: blocca i profili delle due parti, così due accettazioni
-- contemporanee non superano insieme i limiti
create or replace function public.timebank_respond(p_exchange uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ex public.timebank_exchanges%rowtype;
  v_problem text;
begin
  perform public.tool_require_online('timebank');
  select * into v_ex from public.timebank_exchanges where id = p_exchange for update;
  if not found or v_ex.status <> 'proposed' or v_uid not in (v_ex.giver_id, v_ex.receiver_id) or v_ex.proposed_by = v_uid then
    return 'not_allowed';
  end if;
  if not p_accept then
    update public.timebank_exchanges set status = 'cancelled', cancelled_by = v_uid, updated_at = now() where id = p_exchange;
    return 'ok';
  end if;
  if not public.timebank_ready(v_uid) then
    return 'not_verified';
  end if;
  if not public.timebank_ready(v_ex.proposed_by) then
    return 'not_available';
  end if;
  perform 1 from public.timebank_profiles where user_id in (v_ex.giver_id, v_ex.receiver_id) order by user_id for update;
  v_problem := public.timebank_check_limits(v_ex.giver_id, v_ex.receiver_id, v_ex.hours, v_ex.scheduled_on, v_ex.id);
  if v_problem is not null then
    return v_problem;
  end if;
  update public.timebank_exchanges set status = 'accepted', updated_at = now() where id = p_exchange;
  return 'ok';
end;
$$;
revoke all on function public.timebank_respond(uuid, boolean) from public, anon;
grant execute on function public.timebank_respond(uuid, boolean) to authenticated;

create or replace function public.timebank_confirm(p_exchange uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ex public.timebank_exchanges%rowtype;
begin
  perform public.tool_require_online('timebank');
  if public.timebank_blocked(v_uid) then
    return 'not_allowed';
  end if;
  select * into v_ex from public.timebank_exchanges where id = p_exchange for update;
  if not found or v_ex.status <> 'accepted' or v_uid not in (v_ex.giver_id, v_ex.receiver_id) then
    return 'not_allowed';
  end if;
  if v_ex.scheduled_on is not null and v_ex.scheduled_on > (now() at time zone 'Europe/Rome')::date then
    return 'too_early';
  end if;
  if v_uid = v_ex.giver_id then
    update public.timebank_exchanges set giver_confirmed_at = coalesce(giver_confirmed_at, now()), updated_at = now() where id = p_exchange;
  else
    update public.timebank_exchanges set receiver_confirmed_at = coalesce(receiver_confirmed_at, now()), updated_at = now() where id = p_exchange;
  end if;
  select * into v_ex from public.timebank_exchanges where id = p_exchange;
  if v_ex.giver_confirmed_at is not null and v_ex.receiver_confirmed_at is not null then
    perform public.timebank_complete(p_exchange);
    return 'completed';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.timebank_confirm(uuid) from public, anon;
grant execute on function public.timebank_confirm(uuid) to authenticated;

create or replace function public.timebank_dispute(p_exchange uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('timebank');
  if public.timebank_blocked(auth.uid()) then
    return 'not_allowed';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    return 'invalid';
  end if;
  update public.timebank_exchanges set status = 'disputed', dispute_by = auth.uid(),
    dispute_reason = left(trim(p_reason), 1000), updated_at = now()
  where id = p_exchange and auth.uid() in (giver_id, receiver_id) and status = 'accepted';
  return case when found then 'ok' else 'not_allowed' end;
end;
$$;
revoke all on function public.timebank_dispute(uuid, text) from public, anon;
grant execute on function public.timebank_dispute(uuid, text) to authenticated;

create or replace function public.timebank_send(p_exchange uuid, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('timebank');
  if public.timebank_blocked(auth.uid()) then
    return 'not_allowed';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then
    return 'invalid';
  end if;
  if not exists (select 1 from public.timebank_exchanges where id = p_exchange and auth.uid() in (giver_id, receiver_id)
                 and status in ('proposed', 'accepted', 'disputed')) then
    return 'not_allowed';
  end if;
  insert into public.timebank_messages (exchange_id, sender_id, body) values (p_exchange, auth.uid(), left(trim(p_body), 1000));
  return 'ok';
end;
$$;
revoke all on function public.timebank_send(uuid, text) from public, anon;
grant execute on function public.timebank_send(uuid, text) to authenticated;

-- Decisione dello Staff: la contestazione si blocca e si ricontrolla, così due
-- decisioni insieme non lasciano uno scambio "annullato" con le ore passate
create or replace function public.timebank_admin_resolve(p_exchange uuid, p_complete boolean, p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.timebank_exchanges where id = p_exchange for update;
  if v_status is distinct from 'disputed' then
    return 'not_allowed';
  end if;
  update public.timebank_exchanges set staff_note = nullif(left(trim(coalesce(p_note, '')), 1000), '') where id = p_exchange;
  if p_complete then
    perform public.timebank_complete(p_exchange);
  else
    update public.timebank_exchanges set status = 'cancelled', updated_at = now() where id = p_exchange and status = 'disputed';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.timebank_admin_resolve(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.timebank_admin_resolve(uuid, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- Magazzino PRO
-- ---------------------------------------------------------------------------

-- Giacenza iniziale arrotondata come i movimenti; SKU o codice a barre doppi
-- restano un errore chiaro anche con due salvataggi contemporanei
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
  v_barcode text := nullif(regexp_replace(coalesce(p ->> 'barcode', ''), '\s', '', 'g'), '');
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
  if v_sku is not null and exists (select 1 from public.inventory_products where owner_id = v_uid and lower(sku) = lower(v_sku) and id is distinct from p_id) then
    return jsonb_build_object('error', 'sku_taken');
  end if;
  if v_barcode is not null and exists (select 1 from public.inventory_products where owner_id = v_uid and barcode = left(v_barcode, 64) and id is distinct from p_id) then
    return jsonb_build_object('error', 'barcode_taken');
  end if;
  begin
    if p_id is null then
      if (select count(*) from public.inventory_products where owner_id = v_uid) >= 3000 then
        return jsonb_build_object('error', 'too_many');
      end if;
      insert into public.inventory_products (owner_id, name, sku, barcode, category, unit, purchase_price, sale_price, min_stock, supplier, notes)
      values (
        v_uid, left(trim(p ->> 'name'), 120), v_sku, left(v_barcode, 64),
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
      name = left(trim(p ->> 'name'), 120), sku = v_sku, barcode = left(v_barcode, 64),
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

-- Movimenti: un prodotto archiviato va prima ripristinato
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
  if not v_product.is_active then
    return jsonb_build_object('error', 'archived');
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
  if coalesce(p_unit_cost, 0) > 1000000 or coalesce(p_unit_price, 0) > 1000000 then
    return jsonb_build_object('error', 'number');
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

-- La categoria scritta nel prodotto entra nell'elenco ripulita come quelle
-- create dal "+" (spazi doppi tolti); maiuscole diverse = stessa categoria
create or replace function public.inventory_products_category_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(regexp_replace(trim(coalesce(new.category, '')), '\s+', ' ', 'g'), 60);
begin
  if v_name <> '' then
    insert into public.inventory_categories (owner_id, name) values (new.owner_id, v_name)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.inventory_products_category_sync() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cancellazione account (GDPR): anche le categorie del magazzino; gli scambi
-- Time Bank non ancora fatti si annullano (le ore dell'altra parte si liberano)
-- ---------------------------------------------------------------------------
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
  update public.timebank_exchanges set status = 'cancelled', cancelled_by = new.id, updated_at = now()
  where new.id in (giver_id, receiver_id) and status in ('proposed', 'accepted');
  delete from public.timebank_posts where user_id = new.id;
  delete from public.timebank_profiles where user_id = new.id;
  delete from public.timebank_messages where sender_id = new.id;
  delete from public.inventory_products where owner_id = new.id;
  delete from public.inventory_categories where owner_id = new.id;
  return new;
end;
$$;
