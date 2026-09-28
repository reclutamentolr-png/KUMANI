-- Utenti bloccati dallo Staff: i loro contenuti pubblici vengono nascosti
-- (non cancellati) finché restano bloccati; sbloccandoli torna tutto com'era.
-- La posizione nella rete e le persone invitate non cambiano.
--   - Bacheca: annunci nascosti e niente nuovi messaggi verso di loro
--   - Classifiche: esclusi
--   - Spotlight / Kumano del Giorno: esclusi
--   - Link in bio e CV: offline ("Profilo non disponibile")
--   - Codice d'invito: non valido per nuove registrazioni (ci si registra
--     senza codice o con un altro)

create or replace function public.is_user_blocked(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_blocked from public.profiles where id = p_user), false);
$$;
revoke all on function public.is_user_blocked(uuid) from public;
grant execute on function public.is_user_blocked(uuid) to anon, authenticated, service_role;

-- Bacheca: annunci di utenti bloccati invisibili agli altri
drop policy if exists listings_hide_blocked on public.listings;
create policy listings_hide_blocked on public.listings as restrictive for select to public
  using (user_id = (select auth.uid()) or not public.is_user_blocked(user_id));

-- Chat: niente nuovi messaggi verso un utente bloccato
drop policy if exists messages_not_to_blocked on public.messages;
create policy messages_not_to_blocked on public.messages as restrictive for insert to public
  with check (receiver_id is null or not public.is_user_blocked(receiver_id));

-- Spotlight: il controllo comune a pagina, Kumano del Giorno e Home
create or replace function public.spotlight_owner_has_active_subscription(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_user_id
      and pr.subscription_status = 'active'
      and (pr.subscription_expires_at is null or pr.subscription_expires_at > now())
      and not coalesce(pr.is_blocked, false)
  );
$$;

-- Link in bio e CV offline per gli utenti bloccati (le ricevute restano:
-- sono documenti condivisi con l'altra parte)
create or replace function public.public_page_visible(p_owner uuid, p_tool text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  if p_tool <> 'digital-receipt' and public.is_user_blocked(p_owner) then
    return false;
  end if;
  if exists (select 1 from public.tool_access(p_owner, p_tool) t where t.allowed) then
    return true;
  end if;
  if p_tool = 'digital-receipt' then
    -- Strumento spento dallo Staff: le ricevute restano consultabili
    if not public.tool_online(p_tool) then
      return true;
    end if;
    -- Fino a 12 mesi dopo la fine del piano (o della prova Pro)
    select greatest(coalesce(subscription_expires_at, '-infinity'::timestamptz), coalesce(pro_trial_ends_at, '-infinity'::timestamptz))
      into v_last from public.profiles where id = p_owner;
    return v_last is not null and v_last > now() - interval '1 year';
  end if;
  return false;
end;
$$;


-- get_direct_recruiter_leaderboard (ultima versione: database)
CREATE OR REPLACE FUNCTION public.get_direct_recruiter_leaderboard(p_limit integer DEFAULT 10)
 RETURNS TABLE(rank_position integer, profile_user_id uuid, username text, first_name text, last_name text, referral_code text, country_code character, direct_count bigint, badge_level text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH recruiter_stats AS (
        SELECT 
            p.id AS profile_user_id,
            p.username,
            p.first_name,
            p.last_name,
            p.referral_code,
            p.country_code,
            COUNT(children.id) AS direct_count
        FROM public.profiles p
        JOIN public.matrix_nodes my_node ON my_node.user_id = p.id
        LEFT JOIN public.matrix_nodes children ON children.parent_id = my_node.id
        WHERE p.is_active = true AND NOT coalesce(p.is_blocked, false)
        GROUP BY p.id, p.username, p.first_name, p.last_name, p.referral_code, p.country_code
    )
    SELECT 
        ROW_NUMBER() OVER (ORDER BY rs.direct_count DESC, rs.profile_user_id ASC)::int AS rank_position,
        rs.profile_user_id,
        rs.username,
        rs.first_name,
        rs.last_name,
        rs.referral_code,
        rs.country_code,
        rs.direct_count,
        CASE 
            WHEN rs.direct_count >= 51 THEN 'Crown'
            WHEN rs.direct_count >= 21 THEN 'Diamond'
            WHEN rs.direct_count >= 6 THEN 'Rising Star'
            ELSE 'Newbie'
        END AS badge_level
    FROM recruiter_stats rs
    ORDER BY rs.direct_count DESC
    LIMIT p_limit;
END;
$function$;

-- get_total_structure_leaderboard (ultima versione: database)
CREATE OR REPLACE FUNCTION public.get_total_structure_leaderboard(p_limit integer DEFAULT 10)
 RETURNS TABLE(rank_position integer, profile_user_id uuid, username text, first_name text, last_name text, referral_code text, country_code character, total_downline bigint, badge_level text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH structure_stats AS (
        SELECT 
            p.id AS profile_user_id,
            p.username,
            p.first_name,
            p.last_name,
            p.referral_code,
            p.country_code,
            COUNT(mn.id) AS total_downline
        FROM public.profiles p
        JOIN public.matrix_nodes my_node ON my_node.user_id = p.id
        LEFT JOIN public.matrix_nodes mn ON mn.path <@ my_node.path AND mn.user_id != p.id
        WHERE p.is_active = true AND NOT coalesce(p.is_blocked, false)
        GROUP BY p.id, p.username, p.first_name, p.last_name, p.referral_code, p.country_code
    )
    SELECT 
        ROW_NUMBER() OVER (ORDER BY ss.total_downline DESC, ss.profile_user_id ASC)::int AS rank_position,
        ss.profile_user_id,
        ss.username,
        ss.first_name,
        ss.last_name,
        ss.referral_code,
        ss.country_code,
        ss.total_downline,
        CASE 
            WHEN ss.total_downline >= 100 THEN 'Crown'
            WHEN ss.total_downline >= 50 THEN 'Diamond'
            WHEN ss.total_downline >= 20 THEN 'Rising Star'
            ELSE 'Newbie'
        END AS badge_level
    FROM structure_stats ss
    ORDER BY ss.total_downline DESC
    LIMIT p_limit;
END;
$function$;

-- get_user_rankings (ultima versione: database)
CREATE OR REPLACE FUNCTION public.get_user_rankings(p_target_user_id uuid)
 RETURNS TABLE(direct_rank integer, direct_count bigint, structure_rank integer, structure_count bigint, badge_level text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_direct_count bigint;
    v_structure_count bigint;
BEGIN
    -- 1. Count affiliati diretti dell'utente target
    SELECT COUNT(children.id) INTO v_direct_count
    FROM public.matrix_nodes my_node
    LEFT JOIN public.matrix_nodes children ON children.parent_id = my_node.id
    WHERE my_node.user_id = p_target_user_id;

    -- 2. Count struttura totale dell'utente target
    -- CORRETTO: mn.path <@ my_node.path significa "mn è discendente di my_node"
    SELECT COUNT(mn.id) INTO v_structure_count
    FROM public.matrix_nodes my_node
    LEFT JOIN public.matrix_nodes mn ON mn.path <@ my_node.path AND mn.user_id != p_target_user_id
    WHERE my_node.user_id = p_target_user_id;

    -- 3. Calcola i rank confrontando con tutti gli altri utenti
    RETURN QUERY
    WITH all_users_stats AS (
        SELECT 
            p.id AS uid,
            COUNT(children.id) AS d_count,
            COUNT(mn.id) AS s_count
        FROM public.profiles p
        JOIN public.matrix_nodes my_node ON my_node.user_id = p.id
        LEFT JOIN public.matrix_nodes children ON children.parent_id = my_node.id
        LEFT JOIN public.matrix_nodes mn ON mn.path <@ my_node.path AND mn.user_id != p.id
        WHERE p.is_active = true AND NOT coalesce(p.is_blocked, false)
        GROUP BY p.id
    )
    SELECT 
        (SELECT COUNT(*) + 1 FROM all_users_stats WHERE d_count > v_direct_count)::int,
        v_direct_count,
        (SELECT COUNT(*) + 1 FROM all_users_stats WHERE s_count > v_structure_count)::int,
        v_structure_count,
        CASE 
            WHEN v_direct_count >= 51 OR v_structure_count >= 100 THEN 'Crown'
            WHEN v_direct_count >= 21 OR v_structure_count >= 50 THEN 'Diamond'
            WHEN v_direct_count >= 6 OR v_structure_count >= 20 THEN 'Rising Star'
            ELSE 'Newbie'
        END;
END;
$function$;

-- get_public_profile_by_referral (ultima versione: database)
CREATE OR REPLACE FUNCTION public.get_public_profile_by_referral(p_referral_code text)
 RETURNS TABLE(first_name text, last_name text, country_code character, referral_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT p.first_name, p.last_name, p.country_code, p.referral_code
    FROM public.profiles p
    WHERE p.referral_code = p_referral_code
      AND p.is_active = true
      AND NOT coalesce(p.is_blocked, false);
END;
$function$;

-- complete_registration (ultima versione: database)
CREATE OR REPLACE FUNCTION public.complete_registration(p_first_name text, p_last_name text, p_country text, p_city text, p_referral_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_code text := upper(trim(coalesce(p_referral_code, '')));
  v_sponsor uuid;
  v_source text;
  v_house uuid;
  v_thanks_to uuid;
  v_house_node uuid;
begin
  if v_uid is null then
    return 'not_authenticated';
  end if;

  -- Profilo già creato: si completa solo il posto in matrice, se manca.
  select sponsor_id into v_sponsor from public.profiles where id = v_uid;
  if found then
    if not exists (select 1 from public.matrix_nodes where user_id = v_uid) and v_sponsor is not null then
      perform public.place_in_matrix(v_uid, v_sponsor);
    end if;
    return 'ok';
  end if;

  begin
    v_house := public.setting_text('house_account_id')::uuid;
  exception when others then
    v_house := null;
  end;

  if v_code <> '' then
    select id into v_sponsor from public.profiles
    where referral_code = v_code and coalesce(is_active, true) = true and not coalesce(is_blocked, false);
    if v_sponsor is null then
      return 'invalid_referral';
    end if;
    v_source := 'invite';
  else
    if v_house is null or not exists (select 1 from public.profiles where id = v_house) then
      return 'direct_unavailable';
    end if;
    v_sponsor := v_house;
    v_source := 'direct';
    v_thanks_to := public.pick_activity_kumano(p_city, p_country, v_uid);
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.profiles (
    id, email, username, first_name, last_name, country_code, city,
    referral_code, subscription_status, date_of_birth, sponsor_id,
    signup_source, activity_thanks_to
  ) values (
    v_uid,
    v_email,
    split_part(coalesce(v_email, 'kumano'), '@', 1) || '_' || floor(random() * 10000)::int,
    left(trim(p_first_name), 80),
    left(trim(p_last_name), 80),
    upper(left(trim(p_country), 2)),
    nullif(left(trim(coalesce(p_city, '')), 80), ''),
    public.new_referral_code(p_country),
    'free',
    '2000-01-01',
    v_sponsor,
    v_source,
    v_thanks_to
  );

  -- L'account KUMANI senza un posto in matrice diventa una radice propria.
  if v_source = 'direct' and not exists (select 1 from public.matrix_nodes where user_id = v_house) then
    insert into public.matrix_nodes (user_id, parent_id, path, level, "position", depth)
    values (v_house, null, text2ltree('root.' || replace(v_house::text, '-', '_')), 1, 1, 0)
    returning id into v_house_node;
  end if;

  if public.place_in_matrix(v_uid, v_sponsor) is null then
    -- Sponsor senza posto in matrice (dato storico incompleto): si va nella
    -- struttura dell'account KUMANI, se configurato.
    if v_house is not null and v_house <> v_sponsor then
      perform public.place_in_matrix(v_uid, v_house);
    end if;
  end if;

  return 'ok';
end;
$function$;
