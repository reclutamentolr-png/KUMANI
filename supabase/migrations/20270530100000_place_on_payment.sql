-- KUMANI rete (polpo): il posto si prende al pagamento, non all'iscrizione.
--
-- 1. Chi si iscrive resta in «Non ancora KUMANI», collegato a chi l'ha
--    invitato, ma senza posto nei tentacoli. Il posto arriva quando
--    l'abbonamento diventa attivo (Stripe, voucher, regalo, Staff): primo
--    tentacolo libero di chi ha invitato, oppure Spillover se sono pieni.
-- 2. Prenotazione: dal polpo di un proprio Kumano si può mandare un link che
--    chiede il posto sotto di lui (?t=<prime 8 cifre del posto>). Al pagamento si rispetta
--    se quel Kumano è ancora sotto chi ha invitato e ha un tentacolo libero;
--    altrimenti vale la regola normale.
-- 3. Chi invita non ha ancora un posto (non ha pagato): la persona va sotto
--    il primo Kumano piazzato risalendo gli inviti, poi l'account KUMANI.
-- 4. Bonus Accoglienza sempre: se la persona viene accolta da un altro Kumano
--    (Spillover o prenotazione), la maggior parte dei KU Points va a chi ha
--    invitato e il Bonus Accoglienza a chi la accoglie, dal primo invitato.
-- 5. Chi ha già un posto lo tiene, anche se non ha ancora pagato (nessuna
--    pulizia dei posti esistenti).

-- Posto richiesto con il link del polpo di un altro Kumano. Solo le funzioni
-- del database la leggono e la scrivono (nessuna regola di accesso).
create table if not exists public.matrix_placement_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  target_node_id uuid not null references public.matrix_nodes(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.matrix_placement_requests enable row level security;
revoke all on public.matrix_placement_requests from public, anon, authenticated;

-- Dà il posto a chi ha un abbonamento attivo e non l'ha ancora. Idempotente:
-- chi ha già un posto lo tiene. Restituisce il posto (o null se non attivo).
-- p_paid: pagamento appena confermato (punti dell'attivazione), il posto si
-- dà anche se il profilo non risulta ancora attivo.
create or replace function public.ensure_matrix_place(p_user uuid, p_paid boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_node uuid;
  v_house uuid;
  v_sponsor uuid;
  v_host uuid;
  v_hops int := 0;
  v_target uuid;
  v_target_node public.matrix_nodes;
  v_sponsor_path ltree;
  v_pos int;
begin
  select id into v_node from public.matrix_nodes where user_id = p_user;
  if v_node is not null then
    return v_node;
  end if;
  if not p_paid and not exists (
    select 1 from public.profiles p
    where p.id = p_user and p.subscription_status = 'active'
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
  ) then
    return null;
  end if;

  -- Un solo posizionamento alla volta (come place_in_matrix)
  perform pg_advisory_xact_lock(hashtext('kumani_matrix_placement'));
  select id into v_node from public.matrix_nodes where user_id = p_user;
  if v_node is not null then
    return v_node;
  end if;

  begin
    v_house := public.setting_text('house_account_id')::uuid;
  exception when others then
    v_house := null;
  end;
  select sponsor_id into v_sponsor from public.profiles where id = p_user;

  -- Prenotazione: sotto quel Kumano, se è ancora sotto chi ha invitato e ha
  -- un tentacolo libero
  select r.target_node_id into v_target from public.matrix_placement_requests r where r.user_id = p_user;
  if v_target is not null and v_sponsor is not null then
    select path into v_sponsor_path from public.matrix_nodes where user_id = v_sponsor;
    select * into v_target_node from public.matrix_nodes where id = v_target;
    if v_sponsor_path is not null and v_target_node.id is not null and v_target_node.path <@ v_sponsor_path
       and (select count(*) from public.matrix_nodes where parent_id = v_target_node.id) < 5 then
      select min(p) into v_pos
      from generate_series(1, 5) p
      where p not in (select "position" from public.matrix_nodes where parent_id = v_target_node.id);
      insert into public.matrix_nodes (user_id, parent_id, path, level, "position", depth)
      values (p_user, v_target_node.id, v_target_node.path || text2ltree(v_pos::text), v_target_node.level + 1, v_pos, nlevel(v_target_node.path))
      returning id into v_node;
    end if;
  end if;

  if v_node is null then
    -- Chi ha invitato, o il primo Kumano con un posto risalendo gli inviti
    v_host := v_sponsor;
    while v_host is not null and v_hops < 100
      and not exists (select 1 from public.matrix_nodes where user_id = v_host) loop
      select sponsor_id into v_host from public.profiles where id = v_host;
      v_hops := v_hops + 1;
    end loop;
    if v_host is null or not exists (select 1 from public.matrix_nodes where user_id = v_host) then
      v_host := v_house;
    end if;
    if v_host is not null and v_host <> p_user then
      v_node := public.place_in_matrix(p_user, v_host);
    end if;
  end if;

  delete from public.matrix_placement_requests where user_id = p_user;
  return v_node;
end;
$$;
revoke all on function public.ensure_matrix_place(uuid, boolean) from public, anon, authenticated;

-- Abbonamento diventato attivo (da qualunque strada): si prende il posto.
-- Un errore qui non deve mai bloccare l'attivazione: si riprova al prossimo
-- aggiornamento o all'assegnazione dei punti.
create or replace function public.profiles_place_on_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subscription_status = 'active' and (new.subscription_expires_at is null or new.subscription_expires_at > now()) then
    begin
      perform public.ensure_matrix_place(new.id);
    exception when others then
      raise warning 'ensure_matrix_place %: %', new.id, sqlerrm;
    end;
  end if;
  return null;
end;
$$;
revoke all on function public.profiles_place_on_activation() from public, anon, authenticated;

drop trigger if exists profiles_place_on_activation on public.profiles;
create trigger profiles_place_on_activation
  after insert or update of subscription_status, subscription_expires_at on public.profiles
  for each row execute function public.profiles_place_on_activation();

-- Iscrizione: niente posto. Si registra solo l'eventuale prenotazione
-- (placement_node nei dati dell'iscrizione, dal link ?t=).
CREATE OR REPLACE FUNCTION public.complete_registration(p_first_name text, p_last_name text, p_country text, p_city text, p_referral_code text, p_agent_code text DEFAULT ''::text)
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
  v_agent uuid;
  v_place text;
  v_sponsor_path ltree;
  v_targets uuid[];
begin
  if v_uid is null then
    return 'not_authenticated';
  end if;

  -- Profilo già creato: il posto arriva con il pagamento (se già attivo e
  -- senza posto, lo prende ora)
  select sponsor_id into v_sponsor from public.profiles where id = v_uid;
  if found then
    perform public.ensure_matrix_place(v_uid);
    return 'ok';
  end if;

  begin
    v_house := public.setting_text('house_account_id')::uuid;
  exception when others then
    v_house := null;
  end;

  if v_code <> '' then
    select id into v_sponsor from public.profiles
    where referral_code = v_code and coalesce(is_active, true) = true and not coalesce(is_blocked, false)
      -- Gli agenti venditori non fanno parte della rete: niente inviti
      and not exists (select 1 from public.agents ag where ag.user_id = profiles.id);
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
    -- Iscritto dal link di un Agente venditore: la vendita è dell'agente
    -- (niente "Ringraziamento attività" a un Kumano). Codice non valido o
    -- agente sospeso: iscrizione diretta normale.
    select a.user_id into v_agent from public.agents a
    where a.code = upper(trim(coalesce(p_agent_code, ''))) and a.is_active;
    if v_agent is not null then
      v_source := 'agent';
    else
      v_thanks_to := public.pick_activity_kumano(p_city, p_country, v_uid);
    end if;
  end if;

  select email, raw_user_meta_data->>'placement_node' into v_email, v_place from auth.users where id = v_uid;

  insert into public.profiles (
    id, email, username, first_name, last_name, country_code, city,
    referral_code, subscription_status, date_of_birth, sponsor_id,
    signup_source, activity_thanks_to, agent_id
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
    v_thanks_to,
    v_agent
  );

  -- L'account KUMANI senza un posto in matrice diventa una radice propria.
  if v_source in ('direct', 'agent') and not exists (select 1 from public.matrix_nodes where user_id = v_house) then
    insert into public.matrix_nodes (user_id, parent_id, path, level, "position", depth)
    values (v_house, null, text2ltree('root.' || replace(v_house::text, '-', '_')), 1, 1, 0)
    returning id into v_house_node;
  end if;

  -- Prenotazione del posto sotto un Kumano di chi ha invitato: il link porta
  -- le prime 8 cifre del posto, cercate solo tra i Kumani di chi ha invitato
  -- (se ne corrispondono due, nessuna prenotazione)
  v_place := lower(trim(coalesce(v_place, '')));
  if v_source = 'invite' and v_place ~ '^[0-9a-f]{8}(-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$' then
    select path into v_sponsor_path from public.matrix_nodes where user_id = v_sponsor;
    if v_sponsor_path is not null then
      select array_agg(c.id) into v_targets
      from (select t.id from public.matrix_nodes t where t.path <@ v_sponsor_path and t.id::text like v_place || '%' limit 2) c;
      if coalesce(array_length(v_targets, 1), 0) = 1 then
        insert into public.matrix_placement_requests (user_id, target_node_id)
        values (v_uid, v_targets[1])
        on conflict (user_id) do update set target_node_id = excluded.target_node_id, created_at = now();
      end if;
    end if;
  end if;

  return 'ok';
end;
$function$;
revoke all on function public.complete_registration(text, text, text, text, text, text) from public, anon;
grant execute on function public.complete_registration(text, text, text, text, text, text) to authenticated;

-- Invitato in ritardo: si cambia chi ha invitato; il posto (se attivo) si
-- riprende con le regole nuove. Chi ha invitato può non avere ancora un posto.
CREATE OR REPLACE FUNCTION public.assign_late_sponsor(p_user uuid, p_code text, p_ignore_deadline boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_house text := public.setting_text('house_account_id');
  v_days int := public.setting_int('late_sponsor_days', 30);
  v_code text := upper(trim(coalesce(p_code, '')));
  v_profile record;
  v_sponsor uuid;
  v_node uuid;
begin
  -- Stesso blocco del posizionamento in matrice: niente operazioni sovrapposte
  perform pg_advisory_xact_lock(hashtext('kumani_matrix_placement'));

  select signup_source, sponsor_id, created_at, late_sponsor_at into v_profile from public.profiles where id = p_user for update;
  if not found or v_profile.signup_source <> 'direct' or v_profile.sponsor_id::text is distinct from v_house then
    return 'not_direct';
  end if;
  if v_profile.late_sponsor_at is not null then
    return 'already';
  end if;
  if not p_ignore_deadline and v_profile.created_at <= now() - make_interval(days => v_days) then
    return 'expired';
  end if;

  select id into v_sponsor from public.profiles
  where referral_code = v_code and coalesce(is_active, true) = true and not coalesce(is_blocked, false);
  if v_sponsor is null or v_sponsor::text = coalesce(v_house, '') then
    return 'invalid_code';
  end if;
  if v_sponsor = p_user then
    return 'self';
  end if;

  select id into v_node from public.matrix_nodes where user_id = p_user;
  if v_node is not null and exists (select 1 from public.matrix_nodes where parent_id = v_node) then
    return 'has_team';
  end if;

  -- Fuori dalla struttura KUMANI, dentro i Kumani di chi ha invitato
  delete from public.matrix_nodes where user_id = p_user;
  update public.profiles
  set sponsor_id = v_sponsor, signup_source = 'invite', activity_thanks_to = null, late_sponsor_at = now()
  where id = p_user;
  perform public.ensure_matrix_place(p_user);
  return 'ok';
end;
$function$;

-- Punti dell'attivazione: prima il posto (il pagamento può arrivare prima
-- dell'aggiornamento del profilo), poi la divisione. Se la persona è accolta
-- da un altro Kumano, il Bonus Accoglienza va a lui da subito.
create or replace function public.award_activation_points(p_invoice_id text, p_customer uuid, p_kind text, p_scale numeric default 1)
returns table (awarded boolean, sponsor_id uuid, points integer, welcome_user uuid, welcome_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sponsor uuid;
  v_points int;
  v_scale numeric := least(greatest(coalesce(p_scale, 1), 0), 1);
  v_house text := public.setting_text('house_account_id');
  v_id uuid;
  v_receiver uuid;
  v_welcome int := 0;
begin
  if p_kind not in ('activation_base', 'activation_pro', 'upgrade_pro') or p_invoice_id is null then
    return query select false, null::uuid, 0, null::uuid, 0;
    return;
  end if;

  begin
    perform public.ensure_matrix_place(p_customer, true);
  exception when others then
    raise warning 'ensure_matrix_place %: %', p_customer, sqlerrm;
  end;

  select p.sponsor_id into v_sponsor from public.profiles p where p.id = p_customer;
  if v_sponsor is null or v_sponsor::text = coalesce(v_house, '') then
    return query select false, v_sponsor, 0, null::uuid, 0;
    return;
  end if;

  v_points := case p_kind
    when 'activation_base' then public.setting_int('network_points_activation_base', 10)
    when 'activation_pro' then public.setting_int('network_points_activation_pro', 120)
    else public.setting_int('network_points_upgrade_pro', 110)
  end;
  v_points := round(v_points * v_scale);
  if v_points <= 0 then
    return query select false, v_sponsor, 0, null::uuid, 0;
    return;
  end if;

  if p_kind in ('activation_base', 'activation_pro') then
    -- Accolta da un altro Kumano (non chi ha invitato): Bonus Accoglienza
    select parent.user_id into v_receiver
    from public.matrix_nodes child
    join public.matrix_nodes parent on parent.id = child.parent_id
    where child.user_id = p_customer;
    if v_receiver is not null and v_receiver <> v_sponsor and v_receiver::text <> coalesce(v_house, '')
       and not public.is_user_blocked(v_receiver) then
      v_welcome := round(public.setting_int(case when p_kind = 'activation_pro' then 'welcome_bonus_pro' else 'welcome_bonus_base' end,
                                            case when p_kind = 'activation_pro' then 10 else 1 end) * v_scale);
      v_welcome := least(greatest(v_welcome, 0), v_points);
    else
      v_receiver := null;
    end if;
  else
    -- Passaggio a Pro: se all'attivazione la persona era stata accolta da un
    -- altro Kumano, la stessa proporzione del Pro (differenza tra la parte
    -- del Pro e quella del Base) va a chi l'ha accolta
    select a.user_id into v_receiver
    from public.network_point_awards a
    where a.source_user_id = p_customer and a.kind = 'matrix' and a.stripe_invoice_id like 'welcome:%' and a.reversed_at is null
    order by a.created_at desc
    limit 1;
    if v_receiver is not null and v_receiver <> v_sponsor and not public.is_user_blocked(v_receiver) then
      v_welcome := round(greatest(public.setting_int('welcome_bonus_pro', 10) - public.setting_int('welcome_bonus_base', 1), 0) * v_scale);
      v_welcome := least(greatest(v_welcome, 0), v_points);
    else
      v_receiver := null;
    end if;
  end if;

  insert into public.network_point_awards (user_id, source_user_id, kind, points, stripe_invoice_id)
  values (v_sponsor, p_customer, p_kind, greatest(v_points - v_welcome, 1), p_invoice_id)
  on conflict (stripe_invoice_id) do nothing
  returning id into v_id;
  if v_id is null then
    return query select false, v_sponsor, 0, null::uuid, 0;
    return;
  end if;

  update public.profiles
  set network_points = coalesce(network_points, 0) + greatest(v_points - v_welcome, 1),
      network_points_earned_total = coalesce(network_points_earned_total, 0) + greatest(v_points - v_welcome, 1)
  where id = v_sponsor;
  perform public.evaluate_qualifications(v_sponsor);

  if v_welcome > 0 and v_receiver is not null then
    insert into public.network_point_awards (user_id, source_user_id, kind, points, stripe_invoice_id)
    values (v_receiver, p_customer, 'matrix', v_welcome, 'welcome:' || p_invoice_id)
    on conflict (stripe_invoice_id) do nothing;
    update public.profiles
    set network_points = coalesce(network_points, 0) + v_welcome,
        network_points_earned_total = coalesce(network_points_earned_total, 0) + v_welcome
    where id = v_receiver;
    perform public.evaluate_qualifications(v_receiver);
  else
    v_welcome := 0;
    v_receiver := null;
  end if;

  return query select true, v_sponsor, greatest(v_points - v_welcome, 1), v_receiver, v_welcome;
end;
$$;
revoke all on function public.award_activation_points(text, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.award_activation_points(text, uuid, text, numeric) to service_role;

-- Attivi rimasti senza posto (non dovrebbero esserci): lo prendono ora
select public.ensure_matrix_place(p.id)
from public.profiles p
where p.subscription_status = 'active'
  and (p.subscription_expires_at is null or p.subscription_expires_at > now())
  and not exists (select 1 from public.matrix_nodes n where n.user_id = p.id);
