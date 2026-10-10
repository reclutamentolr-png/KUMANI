-- KU Karma del giorno per l'uso di un servizio: solo dal server.
-- Prima award_tool_point() si poteva chiamare direttamente dal browser
-- (utente collegato) e incassare ogni giorno i KU di tutti i servizi senza
-- usarli. Ora la chiama solo il server (chiave di servizio), dopo che
-- un'azione del servizio è andata a buon fine, indicando l'utente.

CREATE OR REPLACE FUNCTION public.award_tool_point_for(p_user uuid, p_tool_name text)
 RETURNS TABLE(awarded boolean, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_rows int;
  v_balance int;
  v_ku int;
begin
  if p_user is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail', 'oxygen',
    'documento-sicuro', 'verifica-iban', 'firma-email', 'calcolatrici', 'focus',
    'landing-page', 'garage', 'mandala', 'scudo-dati', 'casa', 'nexus'
  ) then
    return;
  end if;

  if not exists (select 1 from public.tool_access(p_user, p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (p_user, p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  v_ku := public.ku_points_for(p_tool_name);
  if v_rows = 0 or v_ku = 0 then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + v_ku,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
  where id = p_user
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;

revoke all on function public.award_tool_point_for(uuid, text) from public, anon, authenticated;
grant execute on function public.award_tool_point_for(uuid, text) to service_role;

-- La vecchia funzione non è più chiamabile dal browser
revoke execute on function public.award_tool_point(text) from public, anon, authenticated;

-- Scudo Dati: la restituzione di un controllo prenotato (servizio esterno
-- non riuscito) la fa solo il server. Prima chiunque poteva azzerarsi i
-- contatori e consumare il tetto giornaliero di tutto il sito.
create or replace function public.scudo_dati_release_for(p_user uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  update public.scudo_dati_usage
  set own_checks = greatest(own_checks - case when p_kind = 'own' then 1 else 0 end, 0),
      other_checks = greatest(other_checks - case when p_kind = 'other' then 1 else 0 end, 0)
  where user_id = p_user and day = v_today;
end;
$$;
revoke all on function public.scudo_dati_release_for(uuid, text) from public, anon, authenticated;
grant execute on function public.scudo_dati_release_for(uuid, text) to service_role;
revoke execute on function public.scudo_dati_release(text) from public, anon, authenticated;

-- Regali: una sola email di conferma per ordine (webhook e ritorno da Stripe
-- potevano mandarla entrambi, e ogni ricarica della pagina di nuovo)
alter table public.gift_orders add column if not exists confirmation_sent_at timestamptz;
update public.gift_orders set confirmation_sent_at = created_at where confirmation_sent_at is null;


-- Veritas: l'ordine delle risposte «anonime» si poteva ricalcolare (md5 di
-- id che ogni giocatore riceve) e quindi sapere chi aveva scritto cosa. Ora
-- nel calcolo entra un valore segreto della stanza, che non esce mai.
alter table public.veritas_rooms add column if not exists slot_salt text not null default replace(gen_random_uuid()::text, '-', '');

create or replace function public.veritas_state(p_room uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.veritas_player(p_room, p_token);
  v_room public.veritas_rooms%rowtype;
  v_referral text;
begin
  if v_me is null then
    return jsonb_build_object('error', 'not_player');
  end if;
  perform public.veritas_advance(p_room);
  select * into v_room from public.veritas_rooms where id = p_room;
  select referral_code into v_referral from public.profiles where id = v_room.host_user_id;

  return jsonb_build_object(
    'room_id', v_room.id,
    'code', v_room.code,
    'locale', v_room.locale,
    'status', v_room.status,
    'round', v_room.round,
    'total_rounds', v_room.total_rounds,
    'phase_ends_at', v_room.phase_ends_at,
    'server_now', now(),
    'me', v_me,
    'is_host', v_room.host_player_id = v_me,
    'host_referral', v_referral,
    'question', (select coalesce(q.texts ->> v_room.locale, q.texts ->> 'it') from public.veritas_questions q where q.id = v_room.question_id),
    'i_am_liar', v_room.status in ('writing', 'voting') and v_room.liar_player_id = v_me,
    'my_answer', (select body from public.veritas_answers where room_id = p_room and round = v_room.round and player_id = v_me),
    'my_vote_slot', (
      select s.slot from (
        select a.player_id, row_number() over (order by md5(a.player_id::text || v_room.id::text || v_room.round::text || v_room.slot_salt)) as slot
        from public.veritas_answers a where a.room_id = p_room and a.round = v_room.round
      ) s
      join public.veritas_votes v on v.room_id = p_room and v.round = v_room.round and v.voter_id = v_me and v.target_id = s.player_id
    ),
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'score', p.score,
        'is_host', p.id = v_room.host_player_id,
        'answered', exists (select 1 from public.veritas_answers a where a.room_id = p_room and a.round = v_room.round and a.player_id = p.id),
        'voted', exists (select 1 from public.veritas_votes v where v.room_id = p_room and v.round = v_room.round and v.voter_id = p.id)
      ) order by p.score desc, p.joined_at), '[]'::jsonb)
      from public.veritas_players p where p.room_id = p_room
    ),
    -- Risposte anonime (in ordine mescolato) durante il voto; con autore
    -- e bugiardo solo nella rivelazione.
    'answers', case when v_room.status in ('voting', 'reveal') then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slot', s.slot,
        'body', s.body,
        'mine', s.player_id = v_me,
        'author', case when v_room.status = 'reveal' then (select nickname from public.veritas_players where id = s.player_id) end,
        'is_liar', case when v_room.status = 'reveal' then s.player_id = v_room.liar_player_id end,
        'votes', case when v_room.status = 'reveal' then (
          select count(*) from public.veritas_votes v where v.room_id = p_room and v.round = v_room.round and v.target_id = s.player_id
        ) end
      ) order by s.slot), '[]'::jsonb)
      from (
        select a.player_id, a.body, row_number() over (order by md5(a.player_id::text || v_room.id::text || v_room.round::text || v_room.slot_salt)) as slot
        from public.veritas_answers a where a.room_id = p_room and a.round = v_room.round
      ) s
    ) else '[]'::jsonb end,
    'liar_nickname', case when v_room.status = 'reveal' then (select nickname from public.veritas_players where id = v_room.liar_player_id) end
  );
end;
$$;

create or replace function public.veritas_vote(p_room uuid, p_token text, p_slot int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.veritas_player(p_room, p_token);
  v_room public.veritas_rooms%rowtype;
  v_target uuid;
begin
  perform public.tool_require_online('veritas');
  perform public.tool_require_online('veritas');
  if v_me is null then
    return 'not_player';
  end if;
  select * into v_room from public.veritas_rooms where id = p_room;
  if v_room.status <> 'voting' or now() > v_room.phase_ends_at + interval '3 seconds' then
    return 'closed';
  end if;
  if not exists (select 1 from public.veritas_answers where room_id = p_room and round = v_room.round and player_id = v_me) then
    return 'no_answer';
  end if;
  select s.player_id into v_target from (
    select a.player_id, row_number() over (order by md5(a.player_id::text || v_room.id::text || v_room.round::text || v_room.slot_salt)) as slot
    from public.veritas_answers a where a.room_id = p_room and a.round = v_room.round
  ) s where s.slot = p_slot;
  if v_target is null or v_target = v_me then
    return 'invalid';
  end if;
  insert into public.veritas_votes (room_id, round, voter_id, target_id)
  values (p_room, v_room.round, v_me, v_target)
  on conflict (room_id, round, voter_id) do update set target_id = excluded.target_id, created_at = now();
  perform public.veritas_signal(p_room);
  perform public.veritas_advance(p_room);
  return 'ok';
end;
$$;

-- Regali: un anno di Base non si somma a un piano Pro già attivo (e viceversa)
create or replace function public.redeem_gift_code(p_code text)
returns table (success boolean, reason text, kind text, tool text, plan text, expires_at timestamptz, buyer_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_code public.gift_codes%rowtype;
  v_order public.gift_orders%rowtype;
  v_profile public.profiles%rowtype;
  v_required text;
  v_enabled boolean;
  v_plan_now text;
  v_from timestamptz;
  v_expires timestamptz;
  v_new_plan text;
begin
  if v_uid is null then
    return query select false, 'not_authenticated', null::text, null::text, null::text, null::timestamptz, null::uuid;
    return;
  end if;
  select * into v_code from public.gift_codes where code = upper(trim(p_code)) for update;
  if not found then
    return query select false, 'not_found', null::text, null::text, null::text, null::timestamptz, null::uuid;
    return;
  end if;
  select * into v_order from public.gift_orders where id = v_code.order_id;
  if v_code.revoked_at is not null or v_order.refunded_at is not null then
    return query select false, 'revoked', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  if v_code.redeemed_at is not null then
    return query select false, 'already_used', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  if v_code.valid_until < now() then
    return query select false, 'expired', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  if v_order.buyer_id = v_uid then
    return query select false, 'self', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or coalesce(v_profile.is_blocked, false) then
    return query select false, 'not_allowed', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  v_plan_now := public.plan_of(v_uid);

  if v_order.kind = 'pass' then
    select s.required_plan, s.is_enabled into v_required, v_enabled from public.marketplace_settings s where s.tool_name = v_order.tool;
    if not found or v_enabled is false then
      return query select false, 'unavailable', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
      return;
    end if;
    -- Il servizio è già nel suo piano: il regalo resta per qualcun altro
    if coalesce(v_required, 'base') = 'free'
       or (v_required = 'base' and v_plan_now in ('base', 'pro'))
       or (v_required = 'pro' and v_plan_now = 'pro') then
      return query select false, 'already_included', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
      return;
    end if;
    update public.gift_codes set redeemed_by = v_uid, redeemed_at = now() where code = v_code.code;
    v_expires := public.grant_tool_pass(v_uid, v_order.tool, 365, 'gift', null, null, 0, v_code.code);
    -- Nuovo iscritto arrivato con il regalo e senza piano: dashboard essenziale
    if v_plan_now = 'none' and v_profile.created_at > now() - interval '7 days' then
      update public.profiles set gift_welcome = true where id = v_uid;
    end if;
    return query select true, null::text, v_order.kind, v_order.tool, v_order.plan, v_expires, v_order.buyer_id;
    return;
  end if;

  -- Regalo di un anno di Base o Pro. Con un abbonamento Stripe attivo si
  -- pagherebbe due volte: il regalo resta per qualcun altro.
  if v_profile.subscription_source = 'stripe' and v_profile.subscription_status = 'active'
     and (v_profile.subscription_expires_at is null or v_profile.subscription_expires_at > now()) then
    return query select false, 'already_subscribed', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  -- Piano diverso già attivo (voucher o regalo): un regalo Base non diventa
  -- un anno di Pro, né un Pro trasforma in Pro i mesi Base già pagati
  if v_profile.subscription_status = 'active' and v_profile.subscription_expires_at > now()
     and coalesce(v_profile.subscription_plan, 'base') <> coalesce(v_order.plan, 'base') then
    return query select false, 'plan_mismatch', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  update public.gift_codes set redeemed_by = v_uid, redeemed_at = now() where code = v_code.code;
  -- Piano già attivo con voucher o regalo: l'anno si aggiunge alla scadenza
  v_from := now();
  if v_profile.subscription_status = 'active' and v_profile.subscription_expires_at > now() then
    v_from := v_profile.subscription_expires_at;
  end if;
  v_expires := v_from + interval '1 year';
  v_new_plan := case
    when v_order.plan = 'pro' then 'pro'
    when v_profile.subscription_plan = 'pro' and v_profile.subscription_status = 'active'
      and (v_profile.subscription_expires_at is null or v_profile.subscription_expires_at > now()) then 'pro'
    else 'base'
  end;
  update public.profiles
  set subscription_status = 'active',
      subscription_expires_at = v_expires,
      subscription_source = 'voucher',
      subscription_plan = v_new_plan,
      gift_welcome = false
  where id = v_uid;
  return query select true, null::text, v_order.kind, v_order.tool, v_new_plan, v_expires, v_order.buyer_id;
end;
$$;
