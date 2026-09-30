-- Catalogo premi disattivabile dall'Admin (Punti e premi → interruttore).
-- Spento: la pagina Premi e i collegamenti nel Portafoglio spariscono e il
-- riscatto è bloccato anche qui nel database. Catalogo, riscatti già fatti e
-- pannello Admin restano intatti, pronti per essere riattivati.

insert into public.system_settings (key, value) values ('rewards_catalog_enabled', 'false')
on conflict (key) do nothing;

CREATE OR REPLACE FUNCTION redeem_reward(p_reward_id UUID)
RETURNS TABLE (success BOOLEAN, reason TEXT, new_network_points INT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cost INT;
  v_visible BOOLEAN;
  v_spend RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Catalogo premi spento dall'Admin
  IF coalesce((SELECT value FROM system_settings WHERE key = 'rewards_catalog_enabled'), 'false') <> 'true' THEN
    RETURN QUERY SELECT false, 'not_available', COALESCE((SELECT network_points FROM profiles WHERE id = auth.uid()), 0);
    RETURN;
  END IF;

  SELECT points_cost, is_visible INTO v_cost, v_visible FROM reward_catalog WHERE id = p_reward_id;

  IF v_cost IS NULL THEN
    RETURN QUERY SELECT false, 'not_found', COALESCE((SELECT network_points FROM profiles WHERE id = auth.uid()), 0);
    RETURN;
  END IF;

  IF NOT v_visible THEN
    RETURN QUERY SELECT false, 'not_available', COALESCE((SELECT network_points FROM profiles WHERE id = auth.uid()), 0);
    RETURN;
  END IF;

  SELECT * INTO v_spend FROM spend_network_points(v_cost);

  IF NOT v_spend.success THEN
    RETURN QUERY SELECT false, 'insufficient_points', v_spend.new_network_points;
    RETURN;
  END IF;

  INSERT INTO reward_redemptions (reward_id, user_id, points_spent)
  VALUES (p_reward_id, auth.uid(), v_cost);

  RETURN QUERY SELECT true, NULL::TEXT, v_spend.new_network_points;
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_reward(UUID) TO authenticated;
