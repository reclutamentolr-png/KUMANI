-- Impostazioni: lettura robusta dei numeri e manutenzione lato server.
--
-- 1. Alcune funzioni leggevano i numeri delle impostazioni con un cast
--    diretto (value::int): funzionava solo finché il valore era salvato senza
--    virgolette. Ora accettano anche "10" (come setting_text).
-- 2. maintenance_status(): la modalità manutenzione vale anche lato server
--    (il proxy blocca pagine e salvataggi a chi non è Staff).


-- feature_listing (ultima versione: 20261030100000_more_switches.sql; letture corrette: 1)
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

  SELECT COALESCE(NULLIF(trim(both '"' from value), '')::int, v_default_cost) INTO v_cost
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

-- claim_matrix_slot_bonus (ultima versione: 20260926160000_free_registration.sql; letture corrette: 2)
create or replace function public.claim_matrix_slot_bonus()
returns table (success boolean, awarded integer, direct_slots_paid integer, spillover_slots_paid integer, new_network_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_node_id uuid;
  v_active_direct int;
  v_active_spillover int;
  v_already_direct int;
  v_already_spillover int;
  v_new_direct int;
  v_new_spillover int;
  v_rate_direct int;
  v_rate_spillover int;
  v_awarded int;
  v_balance int;
begin
  if auth.uid() is null then
    return;
  end if;

  select id into v_my_node_id from matrix_nodes where user_id = auth.uid();
  if v_my_node_id is null then
    return query select false, 0, 0, 0, coalesce((select network_points from profiles where id = auth.uid()), 0);
    return;
  end if;

  select
    count(*) filter (where p.sponsor_id = auth.uid()),
    count(*) filter (where p.sponsor_id is distinct from auth.uid() and p.signup_source <> 'direct')
  into v_active_direct, v_active_spillover
  from matrix_nodes child
  join profiles p on p.id = child.user_id
  where child.parent_id = v_my_node_id
    and p.subscription_status = 'active'
    and p.subscription_source = 'stripe'
    and (p.subscription_expires_at is null or p.subscription_expires_at > now());

  select coalesce(matrix_bonus_direct_slots_paid, 0), coalesce(matrix_bonus_spillover_slots_paid, 0)
  into v_already_direct, v_already_spillover
  from profiles where id = auth.uid();

  v_new_direct := greatest(v_active_direct - v_already_direct, 0);
  v_new_spillover := greatest(v_active_spillover - v_already_spillover, 0);

  if v_new_direct = 0 and v_new_spillover = 0 then
    select coalesce(network_points, 0) into v_balance from profiles where id = auth.uid();
    return query select false, 0, v_already_direct, v_already_spillover, v_balance;
    return;
  end if;

  select coalesce(NULLIF(trim(both '"' from value), '')::int, 5) into v_rate_direct
  from system_settings where key = 'matrix_slot_bonus_points';
  v_rate_direct := coalesce(v_rate_direct, 5);

  select coalesce(NULLIF(trim(both '"' from value), '')::int, 5) into v_rate_spillover
  from system_settings where key = 'matrix_spillover_bonus_points';
  v_rate_spillover := coalesce(v_rate_spillover, 5);

  v_awarded := v_new_direct * v_rate_direct + v_new_spillover * v_rate_spillover;

  update profiles
  set
    network_points = coalesce(network_points, 0) + v_awarded,
    matrix_bonus_direct_slots_paid = greatest(v_active_direct, v_already_direct),
    matrix_bonus_spillover_slots_paid = greatest(v_active_spillover, v_already_spillover)
  where id = auth.uid()
    and coalesce(matrix_bonus_direct_slots_paid, 0) = v_already_direct
    and coalesce(matrix_bonus_spillover_slots_paid, 0) = v_already_spillover
  returning network_points into v_balance;

  if not found then
    select coalesce(network_points, 0) into v_balance from profiles where id = auth.uid();
    return query select false, 0, v_already_direct, v_already_spillover, v_balance;
    return;
  end if;

  return query select true, v_awarded, greatest(v_active_direct, v_already_direct), greatest(v_active_spillover, v_already_spillover), v_balance;
end;
$$;

-- claim_sponsor_overflow_bonus (ultima versione: 20260924120000_add_sponsor_overflow_bonus.sql; letture corrette: 1)
CREATE OR REPLACE FUNCTION claim_sponsor_overflow_bonus()
RETURNS TABLE (success BOOLEAN, awarded INT, overflow_paid INT, new_network_points INT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_my_node_id UUID;
  v_active_overflow INT;
  v_already_paid INT;
  v_new_paid INT;
  v_rate INT;
  v_awarded INT;
  v_balance INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_my_node_id FROM matrix_nodes WHERE user_id = auth.uid();

  -- Active, Stripe-paid direct sponsees of the caller whose matrix node did
  -- NOT land under the caller's own node — i.e. the 6th+ direct referral
  -- (or a sponsee with no matrix_nodes row at all, e.g. a failed placement:
  -- sponsor_id already proves affiliation regardless of matrix state).
  SELECT count(*)
  INTO v_active_overflow
  FROM profiles s
  LEFT JOIN matrix_nodes mn ON mn.user_id = s.id
  WHERE s.sponsor_id = auth.uid()
    AND s.subscription_status = 'active'
    AND s.subscription_source = 'stripe'
    AND (s.subscription_expires_at IS NULL OR s.subscription_expires_at > now())
    AND (v_my_node_id IS NULL OR mn.parent_id IS DISTINCT FROM v_my_node_id);

  SELECT COALESCE(sponsor_overflow_bonus_paid, 0) INTO v_already_paid
  FROM profiles WHERE id = auth.uid();

  v_new_paid := GREATEST(v_active_overflow - v_already_paid, 0);

  IF v_new_paid = 0 THEN
    SELECT COALESCE(network_points, 0) INTO v_balance FROM profiles WHERE id = auth.uid();
    RETURN QUERY SELECT false, 0, v_already_paid, v_balance;
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(trim(both '"' from value), '')::int, 10) INTO v_rate
  FROM system_settings WHERE key = 'matrix_slot_bonus_points';
  v_rate := COALESCE(v_rate, 10);

  v_awarded := v_new_paid * v_rate;

  UPDATE profiles
  SET
    network_points = COALESCE(network_points, 0) + v_awarded,
    sponsor_overflow_bonus_paid = v_active_overflow
  WHERE id = auth.uid()
    -- Same atomic stale-read guard used by the other claim_* functions:
    -- only applies if nobody else already advanced this counter
    -- concurrently.
    AND COALESCE(sponsor_overflow_bonus_paid, 0) = v_already_paid
  RETURNING network_points INTO v_balance;

  IF NOT FOUND THEN
    SELECT COALESCE(network_points, 0) INTO v_balance FROM profiles WHERE id = auth.uid();
    RETURN QUERY SELECT false, 0, v_already_paid, v_balance;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_awarded, v_active_overflow, v_balance;
END;
$$;

create or replace function public.maintenance_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enabled', coalesce(public.setting_text('maintenance_mode'), 'false') = 'true',
    'message', coalesce(public.setting_text('maintenance_message'), ''),
    'staff', auth.uid() is not null and (
      exists (select 1 from public.admin_users a where a.user_id = auth.uid())
      or coalesce((select is_admin from public.profiles where id = auth.uid()), false)
    )
  );
$$;
revoke all on function public.maintenance_status() from public;
grant execute on function public.maintenance_status() to anon, authenticated, service_role;
