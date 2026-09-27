-- Messa in sicurezza prima del lancio (audit settembre 2026).
-- 1. award_tool_point: punti solo per strumenti inclusi nel piano.
-- 2. QR Pro / OfferMaker: le pagine pubbliche funzionano solo se il
--    proprietario ha il piano Pro; scrittura dal browser solo con il piano.
-- 3. Kordata: telefono solo al fornitore confermato, ritiro solo ai membri,
--    il capocordata non aderisce alla propria Kordata.
-- 4. Affinity: città visibile solo dopo il match.
-- 5. Profilo: data di nascita e dati verificati col codice fiscale bloccati.
-- 6. Chat Bacheca: il destinatario può cambiare solo "letto"; limite invii.
-- 7. Ricevute digitali: dopo la conferma i dati non si modificano più.
-- 8. Segnalazioni Kordata/Affinity: niente doppioni aperti.
-- 9. OfferMaker AI: contatore giornaliero (come menu_ai_usage).

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
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas'
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

CREATE OR REPLACE FUNCTION public.register_qr_pro_click(p_code text, p_referrer text, p_user_agent text)
 RETURNS TABLE(content_type text, destination jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_content_type TEXT;
  v_destination JSONB;
BEGIN
  UPDATE qr_pro_codes
  SET click_count = click_count + 1
  WHERE qr_pro_codes.code = p_code AND status = 'active'
    AND EXISTS (SELECT 1 FROM public.tool_access(qr_pro_codes.user_id, 'qr-code-pro') t WHERE t.allowed)
  RETURNING id, qr_pro_codes.content_type, qr_pro_codes.destination
  INTO v_id, v_content_type, v_destination;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO qr_pro_clicks (qr_code_id, referrer, user_agent)
  VALUES (v_id, p_referrer, p_user_agent);

  RETURN QUERY SELECT v_content_type, v_destination;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_offer_click(p_code text, p_referrer text, p_user_agent text)
 RETURNS TABLE(code text, locale text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_locale TEXT;
BEGIN
  UPDATE offermaker_campaigns
  SET click_count = click_count + 1
  WHERE offermaker_campaigns.code = p_code AND status = 'published'
    AND EXISTS (SELECT 1 FROM public.tool_access(offermaker_campaigns.user_id, 'offermaker') t WHERE t.allowed)
  RETURNING id, offermaker_campaigns.locale INTO v_id, v_locale;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO offermaker_clicks (campaign_id, referrer, user_agent)
  VALUES (v_id, p_referrer, p_user_agent);

  RETURN QUERY SELECT p_code, v_locale;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_offer_campaign_by_code(p_code text)
 RETURNS TABLE(code text, locale text, campaign_title text, headline text, offer_summary text, description text, cta_label text, whatsapp_message_soft text, whatsapp_message_direct text, whatsapp_message_followup text, contact_whatsapp text, objective text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    code, locale, campaign_title, headline, offer_summary, description, cta_label,
    whatsapp_message_soft, whatsapp_message_direct, whatsapp_message_followup,
    contact_whatsapp, objective
  FROM offermaker_campaigns
  WHERE code = p_code AND status = 'published'
    AND EXISTS (SELECT 1 FROM public.tool_access(offermaker_campaigns.user_id, 'offermaker') t WHERE t.allowed)
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.convivio_detail(p_group uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.convivio_card(g.id, auth.uid()) || jsonb_build_object(
    'description', g.description,
    'pickup_info', case when g.leader_id = auth.uid()
                          or exists (select 1 from public.convivio_pledges where group_id = g.id and user_id = auth.uid())
                          or (g.supplier_id = auth.uid() and g.supplier_status = 'confirmed') then g.pickup_info end,
    'created_at', g.created_at,
    'leader_since', p.created_at,
    'counter_price', g.counter_price,
    'counter_min', g.counter_min,
    'is_member', public.convivio_is_member(g.id, auth.uid()),
    'my_note', (select note from public.convivio_pledges where group_id = g.id and user_id = auth.uid()),
    'my_share_phone', (select share_phone from public.convivio_pledges where group_id = g.id and user_id = auth.uid()),
    'my_reviews', (select coalesce(jsonb_agg(r.target), '[]'::jsonb) from public.convivio_reviews r where r.group_id = g.id and r.reviewer = auth.uid()),
    -- Partecipanti: capocordata e aderenti; il fornitore solo dopo aver
    -- confermato (e il telefono solo di chi lo ha condiviso).
    'participants', case when (g.leader_id = auth.uid() or exists (select 1 from public.convivio_pledges where group_id = g.id and user_id = auth.uid())
                              or (g.supplier_id = auth.uid() and g.supplier_status = 'confirmed')) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', pp.first_name,
        'quantity', cp.quantity,
        'note', case when g.leader_id = auth.uid() or g.supplier_id = auth.uid() then cp.note end,
        'phone', case when cp.share_phone and g.supplier_id = auth.uid() and g.supplier_status = 'confirmed' then pp.phone end
      ) order by cp.created_at), '[]'::jsonb)
      from public.convivio_pledges cp join public.profiles pp on pp.id = cp.user_id
      where cp.group_id = g.id
    ) else '[]'::jsonb end
  )
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  where g.id = p_group and auth.uid() is not null;
$function$;

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

CREATE OR REPLACE FUNCTION public.affinity_friends_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_me public.affinity_profiles%rowtype;
  v_mp public.profiles%rowtype;
  v_week date := date_trunc('week', now())::date;
  v_limit int := greatest(coalesce(nullif(public.setting_text('affinity_intros_per_week'), '')::int, 3), 0);
  v_have int;
  v_intros jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'blocked');
  end if;
  v_status := coalesce(public.affinity_friends_status(v_uid), 'blocked');
  select * into v_me from public.affinity_profiles where user_id = v_uid;
  select * into v_mp from public.profiles where id = v_uid;

  if v_status = 'ok' and v_me.opt_friends then
    select count(*) into v_have from public.affinity_intros
    where week = v_week and v_uid in (user_a, user_b);

    if v_have < v_limit then
      insert into public.affinity_intros (week, user_a, user_b, score)
      select v_week, least(v_uid, c.user_id), greatest(v_uid, c.user_id), c.score
      from (
        select a2.user_id,
          round(100 * (1 - sqrt(
            power((v_me.map ->> 'valori')::numeric - (a2.map ->> 'valori')::numeric, 2) +
            power((v_me.map ->> 'ritmo')::numeric - (a2.map ->> 'ritmo')::numeric, 2) +
            power((v_me.map ->> 'curiosita')::numeric - (a2.map ->> 'curiosita')::numeric, 2) +
            power((v_me.map ->> 'calore')::numeric - (a2.map ->> 'calore')::numeric, 2) +
            power((v_me.map ->> 'avventura')::numeric - (a2.map ->> 'avventura')::numeric, 2)
          ) / sqrt(5)))::int as score,
          -- Prima la lingua in comune, poi paese e città (funziona anche con pochi iscritti)
          (case when a2.languages && v_me.languages then 15 else 0 end)
          + (case when p2.country_code = v_mp.country_code then 10 else 0 end)
          + (case when v_mp.city is not null and lower(trim(p2.city)) = lower(trim(v_mp.city)) then 5 else 0 end) as bonus
        from public.affinity_profiles a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.opt_friends
          and a2.user_id <> v_uid
          and public.affinity_friends_status(a2.user_id) = 'ok'
          and not public.affinity_is_blocked(v_uid, a2.user_id)
          and not exists (
            select 1 from public.affinity_intros i
            where i.user_a = least(v_uid, a2.user_id) and i.user_b = greatest(v_uid, a2.user_id)
          )
          and (select count(*) from public.affinity_intros i2 where i2.week = v_week and a2.user_id in (i2.user_a, i2.user_b)) < v_limit
      ) c
      order by c.score + c.bonus desc, md5(c.user_id::text || v_week::text)
      limit (v_limit - v_have)
      on conflict (user_a, user_b) do nothing;
    end if;
  end if;

  select coalesce(jsonb_agg(r.item order by (r.item ->> 'week') desc, (r.item ->> 'score')::int desc), '[]'::jsonb) into v_intros
  from (
    select jsonb_build_object(
      'id', i.id,
      'week', i.week,
      'other_id', o.id,
      'first_name', o.first_name,
      'city', case when i.a_response = 'yes' and i.b_response = 'yes' then o.city end,
      'verified', o.created_at <= now() - interval '30 days',
      'archetype', oa.archetype,
      'map', oa.map,
      'bio', oa.bio,
      'score', i.score,
      'status', case
        when my.resp = 'no' then 'declined'
        when my.resp is null then 'pending'
        when their.resp = 'yes' then 'match'
        when their.resp = 'no' then 'closed'
        else 'waiting'
      end,
      'unread', (
        select count(*) from public.affinity_messages m
        where m.intro_id = i.id and m.sender_id <> v_uid and m.read_at is null
      )
    ) as item
    from public.affinity_intros i
    cross join lateral (select case when i.user_a = v_uid then i.a_response else i.b_response end as resp) my
    cross join lateral (select case when i.user_a = v_uid then i.b_response else i.a_response end as resp) their
    join public.profiles o on o.id = case when i.user_a = v_uid then i.user_b else i.user_a end
    left join public.affinity_profiles oa on oa.user_id = o.id
    where v_uid in (i.user_a, i.user_b)
      and not public.affinity_is_blocked(v_uid, o.id)
      and (i.week = v_week or (i.a_response = 'yes' and i.b_response = 'yes'))
  ) r;

  return jsonb_build_object(
    'status', v_status,
    'has_map', v_me.user_id is not null,
    'opted_in', coalesce(v_me.opt_friends, false),
    'bio', v_me.bio,
    'languages', to_jsonb(coalesce(v_me.languages, '{}')),
    'per_week', v_limit,
    'intros', v_intros
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_allowed text[] := array[
    'first_name', 'last_name', 'username', 'phone', 'country_code', 'date_of_birth',
    'gender', 'city', 'address', 'postal_code', 'province', 'occupation',
    'last_seen', 'qualifications_seen', 'updated_at'
  ];
  v_changes jsonb;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Creazione del proprio profilo alla registrazione: valori privilegiati
    -- sempre ai default, email = quella dell'account che fa la richiesta
    -- (la policy di INSERT impone già id = auth.uid()).
    new.email := coalesce(auth.email(), new.email);
    new.is_admin := false;
    new.is_blocked := false;
    new.is_verified := false;
    new.is_active := true;
    new.network_points := 0;
    new.daily_points := 0;
    new.last_daily_login := null;
    new.total_listings := 0;
    new.rank_bonuses_claimed := '{}';
    new.qualifications_seen := '{}';
    new.subscription_status := 'free';
    new.subscription_expires_at := null;
    new.subscription_source := null;
    new.matrix_bonus_direct_slots_paid := 0;
    new.matrix_bonus_spillover_slots_paid := 0;
    new.sponsor_overflow_bonus_paid := 0;
    return new;
  end if;

  -- UPDATE: si parte dalla riga vecchia e si applicano solo le colonne ammesse.
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_changes
  from jsonb_each(to_jsonb(new))
  where key = any(v_allowed);

  new := jsonb_populate_record(old, v_changes);

  -- Dati anagrafici "certificati": modificabili solo dallo Staff.
  if old.date_of_birth is not null and old.date_of_birth <> date '2000-01-01' then
    new.date_of_birth := old.date_of_birth;
  end if;
  if old.tax_code is not null then
    new.first_name := old.first_name;
    new.last_name := old.last_name;
    new.date_of_birth := old.date_of_birth;
  end if;
  return new;
end;
$function$;

-- 2b. Scrittura dal browser su QR Pro / OfferMaker solo con il piano attivo
drop policy if exists "qr_pro_requires_plan_insert" on public.qr_pro_codes;
create policy "qr_pro_requires_plan_insert" on public.qr_pro_codes as restrictive for insert to authenticated
  with check (exists (select 1 from public.tool_access(auth.uid(), 'qr-code-pro') t where t.allowed));
drop policy if exists "qr_pro_requires_plan_update" on public.qr_pro_codes;
create policy "qr_pro_requires_plan_update" on public.qr_pro_codes as restrictive for update to authenticated
  using (exists (select 1 from public.tool_access(auth.uid(), 'qr-code-pro') t where t.allowed));
drop policy if exists "offermaker_requires_plan_insert" on public.offermaker_campaigns;
create policy "offermaker_requires_plan_insert" on public.offermaker_campaigns as restrictive for insert to authenticated
  with check (exists (select 1 from public.tool_access(auth.uid(), 'offermaker') t where t.allowed));
drop policy if exists "offermaker_requires_plan_update" on public.offermaker_campaigns;
create policy "offermaker_requires_plan_update" on public.offermaker_campaigns as restrictive for update to authenticated
  using (exists (select 1 from public.tool_access(auth.uid(), 'offermaker') t where t.allowed));

-- 6. Chat Bacheca
revoke update on public.messages from authenticated, anon;
grant update (is_read) on public.messages to authenticated;

create or replace function public.messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and (
    select count(*) from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.messages_rate_limit();

-- 7. Ricevute digitali confermate: restano modificabili solo restituzione e
--    promemoria collegato.
create or replace function public.digital_receipts_lock_confirmed()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and old.confirmed_at is not null then
    new := jsonb_populate_record(old, jsonb_build_object(
      'returned_at', new.returned_at,
      'life_calendar_item_id', new.life_calendar_item_id,
      'updated_at', new.updated_at
    ));
  end if;
  return new;
end;
$$;
drop trigger if exists digital_receipts_lock_confirmed on public.digital_receipts;
create trigger digital_receipts_lock_confirmed before update on public.digital_receipts
  for each row execute function public.digital_receipts_lock_confirmed();

-- 8. Segnalazioni: una sola aperta per segnalatore e bersaglio
create or replace function public.skip_duplicate_open_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'convivio_reports' then
    if exists (select 1 from public.convivio_reports where reporter = new.reporter and group_id = new.group_id and status = 'open') then
      return null;
    end if;
  elsif tg_table_name = 'affinity_reports' then
    if exists (select 1 from public.affinity_reports where reporter = new.reporter and reported = new.reported and status = 'open') then
      return null;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists convivio_reports_dedupe on public.convivio_reports;
create trigger convivio_reports_dedupe before insert on public.convivio_reports
  for each row execute function public.skip_duplicate_open_report();
drop trigger if exists affinity_reports_dedupe on public.affinity_reports;
create trigger affinity_reports_dedupe before insert on public.affinity_reports
  for each row execute function public.skip_duplicate_open_report();

-- 9. OfferMaker AI: utilizzi giornalieri
create table if not exists public.offermaker_ai_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  runs int not null default 0,
  primary key (owner_id, used_on)
);
alter table public.offermaker_ai_usage enable row level security;
drop policy if exists "offermaker_ai_usage_own" on public.offermaker_ai_usage;
create policy "offermaker_ai_usage_own" on public.offermaker_ai_usage for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update on public.offermaker_ai_usage to authenticated;
