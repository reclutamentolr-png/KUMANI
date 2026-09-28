-- Interruttori Admin anche per Kordata, Spotlight, Bacheca e chat.
-- Le regole di oggi non cambiano (righe create con i piani attuali): cambia
-- solo che lo Staff può spegnerli o cambiarne il piano da Admin.
--   - Kordata spenta: sola lettura (si vedono Kordate e ordini, niente nuove
--     Kordate, adesioni, messaggi, recensioni; le commissioni dovute si pagano)
--   - Spotlight spento: nascosto (pagina e Kumano del Giorno), storie salvate
--   - Bacheca spenta: sola lettura (annunci visibili, niente nuovi, rinnovi o
--     messe in evidenza); la chat resta aperta
--   - Chat spenta: si leggono i messaggi, non se ne mandano di nuovi

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description) values
  ('convivio', true, 'free', 'Kordata – acquisti di gruppo. Spenta: sola lettura (niente nuove Kordate, adesioni o messaggi)'),
  ('listings', true, 'free', 'Bacheca annunci. Spenta: sola lettura (niente nuovi annunci, rinnovi o messe in evidenza)'),
  ('chat', true, 'free', 'Chat della Bacheca. Spenta: si leggono i messaggi ma non se ne inviano di nuovi'),
  ('spotlight', true, 'base', 'Spotlight e Kumano del Giorno. Spento: nascosto (storie salvate)')
on conflict (tool_name) do nothing;


-- ---------------------------------------------------------------------------
-- Kordata
-- ---------------------------------------------------------------------------

-- convivio_create (ultima versione: 20261009100000_convivio_suppliers.sql)
create or replace function public.convivio_create(
  p_title text, p_description text, p_category text, p_supplier text, p_unit text,
  p_retail numeric, p_price numeric, p_min int, p_max int, p_expires timestamptz, p_pickup text,
  p_supplier_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_own_offer boolean := p_supplier_id is not null and p_supplier_id = auth.uid();
  v_supplier public.convivio_suppliers%rowtype;
  v_id uuid;
  v_limit int;
begin
  perform public.tool_require_online('convivio');
  if v_uid is null then
    return jsonb_build_object('error', 'not_verified');
  end if;
  if v_own_offer then
    if not public.convivio_supplier_active(v_uid) then
      return jsonb_build_object('error', 'not_supplier');
    end if;
  elsif not public.convivio_is_verified(v_uid) then
    return jsonb_build_object('error', 'not_verified');
  end if;
  if p_supplier_id is not null then
    if not public.convivio_supplier_active(p_supplier_id) then
      return jsonb_build_object('error', 'supplier_unavailable');
    end if;
    select * into v_supplier from public.convivio_suppliers where user_id = p_supplier_id;
  end if;
  v_limit := case when v_own_offer then 10 else 3 end;
  if (select count(*) from public.convivio_groups where leader_id = v_uid and status in ('open', 'ordered')) >= v_limit then
    return jsonb_build_object('error', 'too_many');
  end if;
  if p_expires < now() + interval '1 day' or p_expires > now() + interval '60 days' then
    return jsonb_build_object('error', 'bad_deadline');
  end if;
  if coalesce(p_price, -1) < 0 or coalesce(p_min, 0) < 2 or (p_max is not null and p_max < p_min) then
    return jsonb_build_object('error', 'invalid');
  end if;
  insert into public.convivio_groups (leader_id, title, description, category, supplier_name, unit_label, retail_price, group_price,
    min_participants, max_participants, expires_at, pickup_info, city, supplier_id, supplier_status)
  values (
    v_uid, left(trim(p_title), 100), left(trim(coalesce(p_description, '')), 2000),
    case when p_category in ('food', 'tech', 'travel', 'energy', 'other') then p_category else 'other' end,
    coalesce(v_supplier.business_name, left(trim(coalesce(p_supplier, '')), 120)), left(trim(coalesce(p_unit, '')), 40),
    p_retail, p_price, least(p_min, 500), p_max, p_expires, left(trim(coalesce(p_pickup, '')), 1000),
    coalesce(v_supplier.city, (select city from public.profiles where id = v_uid)),
    p_supplier_id,
    case when p_supplier_id is null then 'none' when v_own_offer then 'confirmed' else 'pending' end
  )
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;

-- convivio_join (ultima versione: 20261011100000_security_hardening.sql)
CREATE OR REPLACE FUNCTION public.convivio_join(p_group uuid, p_quantity integer, p_note text, p_share_phone boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group public.convivio_groups%rowtype;
  v_member boolean;
begin
  perform public.tool_require_online('convivio');
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return 'not_allowed';
  end if;
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found or public.convivio_status(p_group) <> 'open' then
    return 'closed';
  end if;
  if v_group.supplier_id = v_uid or v_group.leader_id = v_uid then
    return 'not_allowed';
  end if;
  v_member := exists (select 1 from public.convivio_pledges where group_id = p_group and user_id = v_uid);
  if not v_member and v_group.max_participants is not null and public.convivio_people(p_group) >= v_group.max_participants then
    return 'full';
  end if;
  insert into public.convivio_pledges (group_id, user_id, quantity, note, share_phone)
  values (p_group, v_uid, least(greatest(coalesce(p_quantity, 1), 1), 50), nullif(left(trim(coalesce(p_note, '')), 200), ''), coalesce(p_share_phone, false))
  on conflict (group_id, user_id) do update set quantity = excluded.quantity, note = excluded.note, share_phone = excluded.share_phone, updated_at = now();
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$function$;

-- convivio_leave (ultima versione: 20261008100000_convivio.sql)
create or replace function public.convivio_leave(p_group uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('convivio');
  if public.convivio_status(p_group) <> 'open' then
    return 'closed';
  end if;
  delete from public.convivio_pledges where group_id = p_group and user_id = auth.uid();
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;

-- convivio_send (ultima versione: 20261008100000_convivio.sql)
create or replace function public.convivio_send(p_group uuid, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('convivio');
  if not public.convivio_is_member(p_group, auth.uid()) then
    return 'not_member';
  end if;
  if nullif(trim(coalesce(p_body, '')), '') is null then
    return 'empty';
  end if;
  if (select count(*) from public.convivio_messages where sender_id = auth.uid() and created_at > now() - interval '1 day') >= 100 then
    return 'rate_limited';
  end if;
  insert into public.convivio_messages (group_id, sender_id, body) values (p_group, auth.uid(), left(trim(p_body), 1000));
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;

-- convivio_review (ultima versione: 20261009100000_convivio_suppliers.sql)
create or replace function public.convivio_review(p_group uuid, p_target text, p_rating int, p_comment text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.convivio_groups%rowtype;
  v_target uuid;
begin
  perform public.tool_require_online('convivio');
  select * into v_group from public.convivio_groups where id = p_group;
  if not found or v_group.status <> 'completed' then
    return 'not_allowed';
  end if;
  if not exists (select 1 from public.convivio_pledges where group_id = p_group and user_id = auth.uid()) then
    return 'not_allowed';
  end if;
  v_target := case p_target when 'supplier' then v_group.supplier_id when 'leader' then v_group.leader_id end;
  if v_target is null or v_target = auth.uid() or coalesce(p_rating, 0) not between 1 and 5 then
    return 'invalid';
  end if;
  insert into public.convivio_reviews (group_id, reviewer, target, target_id, rating, comment)
  values (p_group, auth.uid(), p_target, v_target, p_rating, nullif(left(trim(coalesce(p_comment, '')), 300), ''))
  on conflict (group_id, reviewer, target) do update set rating = excluded.rating, comment = excluded.comment;
  return 'ok';
end;
$$;

-- convivio_set_status (ultima versione: 20261009100000_convivio_suppliers.sql)
create or replace function public.convivio_set_status(p_group uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.convivio_groups%rowtype;
  v_status text;
  v_is_leader boolean;
  v_is_supplier boolean;
begin
  perform public.tool_require_online('convivio');
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found then
    return 'not_allowed';
  end if;
  v_is_leader := v_group.leader_id = auth.uid();
  v_is_supplier := v_group.supplier_id = auth.uid() and v_group.supplier_status = 'confirmed';
  if not (v_is_leader or v_is_supplier) then
    return 'not_allowed';
  end if;
  v_status := public.convivio_status(p_group);
  if p_status = 'ordered' then
    if v_group.supplier_id is not null and v_group.supplier_status <> 'confirmed' then
      return 'supplier_not_confirmed';
    end if;
    if not (v_status in ('open', 'reached') and public.convivio_people(p_group) >= v_group.min_participants) then
      return 'not_reached';
    end if;
  elsif p_status = 'completed' then
    if v_status <> 'ordered' then
      return 'not_ordered';
    end if;
  elsif p_status = 'cancelled' then
    if v_status in ('completed', 'cancelled') then
      return 'not_allowed';
    end if;
  else
    return 'not_allowed';
  end if;
  update public.convivio_groups set status = p_status, updated_at = now() where id = p_group;
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;

-- convivio_supplier_respond (ultima versione: 20261016100000_identity_rules_fees.sql)
create or replace function public.convivio_supplier_respond(p_group uuid, p_action text, p_price numeric default null, p_min int default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.convivio_groups%rowtype;
begin
  perform public.tool_require_online('convivio');
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found or v_group.supplier_id is distinct from auth.uid() or v_group.status <> 'open' then
    return 'not_allowed';
  end if;
  if v_group.supplier_status not in ('pending', 'counter') then
    return 'already_answered';
  end if;
  if p_action in ('accept', 'counter')
     and coalesce((select sum(amount) from public.convivio_fees where supplier_id = auth.uid() and status = 'due'), 0) >= 0.5 then
    return 'fees_due';
  end if;
  if p_action = 'accept' then
    update public.convivio_groups set supplier_status = 'confirmed', counter_price = null, counter_min = null, updated_at = now() where id = p_group;
  elsif p_action = 'decline' then
    update public.convivio_groups set supplier_status = 'declined', updated_at = now() where id = p_group;
  elsif p_action = 'counter' then
    if coalesce(p_price, v_group.group_price) < 0 or coalesce(p_min, v_group.min_participants) < 2 then
      return 'invalid';
    end if;
    update public.convivio_groups
    set supplier_status = 'counter', counter_price = coalesce(p_price, group_price), counter_min = coalesce(p_min, min_participants), updated_at = now()
    where id = p_group;
  else
    return 'not_allowed';
  end if;
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;

-- convivio_supplier_save (ultima versione: 20261022100000_vat_international.sql)
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
  perform public.tool_require_online('convivio');
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

-- convivio_update_info (ultima versione: 20261008100000_convivio.sql)
create or replace function public.convivio_update_info(p_group uuid, p_description text, p_pickup text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('convivio');
  update public.convivio_groups
  set description = left(trim(coalesce(p_description, '')), 2000), pickup_info = left(trim(coalesce(p_pickup, '')), 1000), updated_at = now()
  where id = p_group and leader_id = auth.uid() and status in ('open', 'ordered');
  if not found then
    return 'not_allowed';
  end if;
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;

-- convivio_counter_answer (ultima versione: 20261009100000_convivio_suppliers.sql)
create or replace function public.convivio_counter_answer(p_group uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.convivio_groups%rowtype;
begin
  perform public.tool_require_online('convivio');
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found or v_group.leader_id <> auth.uid() or v_group.supplier_status <> 'counter' or v_group.status <> 'open' then
    return 'not_allowed';
  end if;
  if p_accept then
    update public.convivio_groups
    set group_price = coalesce(counter_price, group_price),
        min_participants = coalesce(counter_min, min_participants),
        max_participants = case when max_participants is not null and max_participants < coalesce(counter_min, min_participants) then coalesce(counter_min, min_participants) else max_participants end,
        supplier_status = 'confirmed', counter_price = null, counter_min = null, updated_at = now()
    where id = p_group;
  else
    update public.convivio_groups set supplier_status = 'declined', updated_at = now() where id = p_group;
  end if;
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- Bacheca e chat
-- ---------------------------------------------------------------------------

-- feature_listing (ultima versione: 20260922190000_add_listing_showcase.sql)
CREATE OR REPLACE FUNCTION feature_listing(p_listing_id UUID, p_duration_days INT)
RETURNS TABLE (success BOOLEAN, reason TEXT, featured_until TIMESTAMPTZ, new_network_points INT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner UUID;
  v_cost INT;
  v_setting_key TEXT;
  v_default_cost INT;
  v_spend RECORD;
  v_featured_until TIMESTAMPTZ;
  v_balance INT;
BEGIN
  perform public.tool_require_online('listings');
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(network_points, 0) INTO v_balance FROM profiles WHERE id = auth.uid();

  IF p_duration_days NOT IN (7, 15) THEN
    RETURN QUERY SELECT false, 'invalid_duration', NULL::TIMESTAMPTZ, v_balance;
    RETURN;
  END IF;

  SELECT user_id INTO v_owner FROM listings WHERE id = p_listing_id;
  IF v_owner IS NULL THEN
    RETURN QUERY SELECT false, 'not_found', NULL::TIMESTAMPTZ, v_balance;
    RETURN;
  END IF;
  IF v_owner != auth.uid() THEN
    RETURN QUERY SELECT false, 'not_owner', NULL::TIMESTAMPTZ, v_balance;
    RETURN;
  END IF;

  v_setting_key := CASE p_duration_days WHEN 7 THEN 'listing_feature_cost_7d' ELSE 'listing_feature_cost_15d' END;
  v_default_cost := CASE p_duration_days WHEN 7 THEN 20 ELSE 35 END;

  SELECT COALESCE(NULLIF(value, '')::int, v_default_cost) INTO v_cost
  FROM system_settings WHERE key = v_setting_key;
  v_cost := COALESCE(v_cost, v_default_cost);

  SELECT * INTO v_spend FROM spend_network_points(v_cost);
  IF NOT v_spend.success THEN
    RETURN QUERY SELECT false, 'insufficient_points', NULL::TIMESTAMPTZ, v_spend.new_network_points;
    RETURN;
  END IF;

  v_featured_until := now() + (p_duration_days || ' days')::interval;

  UPDATE listings SET featured_until = v_featured_until WHERE id = p_listing_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_featured_until, v_spend.new_network_points;
END;
$$;

-- feature_listing_ku (ultima versione: 20260927100000_ku_management.sql)
create or replace function public.feature_listing_ku(p_listing_id uuid, p_duration_days integer)
returns table (success boolean, reason text, featured_until timestamptz, new_daily_points integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_config jsonb := public.ku_feature_config('showcase');
  v_owner uuid;
  v_cost int;
  v_until timestamptz;
  v_balance int;
begin
  perform public.tool_require_online('listings');
  if auth.uid() is null then
    return;
  end if;
  select coalesce(daily_points, 0) into v_balance from profiles where id = auth.uid();
  if v_config is null then
    return query select false, 'disabled', null::timestamptz, v_balance; return;
  end if;
  if p_duration_days not in (7, 15) then
    return query select false, 'invalid_duration', null::timestamptz, v_balance; return;
  end if;
  select user_id into v_owner from listings where id = p_listing_id;
  if v_owner is null or v_owner <> auth.uid() then
    return query select false, 'not_owner', null::timestamptz, v_balance; return;
  end if;

  v_cost := coalesce((v_config ->> case p_duration_days when 7 then 'cost_7d' else 'cost_15d' end)::int, 0);
  if v_cost <= 0 or not public.ku_spend(auth.uid(), v_cost) then
    return query select false, 'insufficient_points', null::timestamptz, v_balance; return;
  end if;

  -- Se è già in vetrina, i giorni si sommano a quelli rimasti.
  select greatest(coalesce(l.featured_until, now()), now()) + make_interval(days => p_duration_days)
    into v_until from listings l where l.id = p_listing_id;
  update listings set featured_until = v_until where id = p_listing_id;
  insert into ku_transactions (user_id, kind, ku_amount, details)
    values (auth.uid(), 'showcase', v_cost, jsonb_build_object('listing_id', p_listing_id, 'days', p_duration_days));

  select coalesce(daily_points, 0) into v_balance from profiles where id = auth.uid();
  return query select true, null::text, v_until, v_balance;
end;
$$;

drop policy if exists listings_online_update on public.listings;
create policy listings_online_update on public.listings as restrictive for update to public
  using (public.tool_online('listings'));

drop policy if exists messages_online_insert on public.messages;
create policy messages_online_insert on public.messages as restrictive for insert to public
  with check (public.tool_online('chat'));

-- ---------------------------------------------------------------------------
-- Spotlight: il controllo comune a pagina, Kumano del Giorno e Home
-- ---------------------------------------------------------------------------
create or replace function public.spotlight_owner_has_active_subscription(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tool_online('spotlight') and exists (
    select 1 from public.profiles pr
    where pr.id = p_user_id
      and pr.subscription_status = 'active'
      and (pr.subscription_expires_at is null or pr.subscription_expires_at > now())
      and not coalesce(pr.is_blocked, false)
  );
$$;

