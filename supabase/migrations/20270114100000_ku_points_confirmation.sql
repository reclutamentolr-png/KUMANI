-- KU Points confermati dopo 15 giorni
--
-- Ogni accredito di KU Points (attivazione, passaggio a Pro, Bonus
-- Accoglienza, Pass) diventa definitivo 15 giorni dopo il pagamento: il
-- tempo del diritto di recesso (14 giorni) più un giorno di margine. Fino ad
-- allora i punti si vedono ma:
--   - non contano per le qualifiche (né i punti né l'attivazione), quindi i
--     voucher premio arrivano solo con attivazioni non rimborsate;
--   - non si possono spendere (vetrina, donazioni, catalogo premi).
-- Le qualifiche si ricontrollano ogni giorno (cron) per chi ha punti appena
-- confermati, oltre che a ogni apertura della dashboard.

insert into public.system_settings (key, value) values ('points_confirm_days', '15')
on conflict (key) do nothing;

create or replace function public.points_confirm_cutoff()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select now() - make_interval(days => greatest(public.setting_int('points_confirm_days', 15), 0));
$$;
revoke all on function public.points_confirm_cutoff() from public, anon, authenticated;

-- Punti ancora in conferma (non rimborsati, più recenti di 15 giorni)
create or replace function public.pending_points_of(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(points), 0)::int from public.network_point_awards
  where user_id = p_user and reversed_at is null and created_at > public.points_confirm_cutoff();
$$;
revoke all on function public.pending_points_of(uuid) from public, anon, authenticated;

-- Punti confermati guadagnati in totale (per le qualifiche)
create or replace function public.confirmed_points_of(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(points), 0)::int from public.network_point_awards
  where user_id = p_user and reversed_at is null and created_at <= public.points_confirm_cutoff();
$$;
revoke all on function public.confirmed_points_of(uuid) from public, anon, authenticated;

-- Attivazioni pagate e confermate (contano per le qualifiche)
create or replace function public.paid_activations_of(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct a.source_user_id)::int
  from public.network_point_awards a
  where a.user_id = p_user and a.kind in ('activation_base', 'activation_pro') and a.reversed_at is null
    and a.created_at <= public.points_confirm_cutoff();
$$;
revoke all on function public.paid_activations_of(uuid) from public, anon, authenticated;

-- Attivazioni ancora in conferma (solo per mostrarle)
create or replace function public.pending_activations_of(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct a.source_user_id)::int
  from public.network_point_awards a
  where a.user_id = p_user and a.kind in ('activation_base', 'activation_pro') and a.reversed_at is null
    and a.created_at > public.points_confirm_cutoff()
    and not exists (
      select 1 from public.network_point_awards b
      where b.user_id = p_user and b.source_user_id = a.source_user_id and b.kind in ('activation_base', 'activation_pro')
        and b.reversed_at is null and b.created_at <= public.points_confirm_cutoff()
    );
$$;
revoke all on function public.pending_activations_of(uuid) from public, anon, authenticated;

-- Qualifiche: come prima, ma con punti e attivazioni confermati
create or replace function public.evaluate_qualifications(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rules jsonb := public.qualification_rules();
  v_acts int := public.paid_activations_of(p_user);
  v_pts int := public.confirmed_points_of(p_user);
  v_rule jsonb;
  v_black jsonb;
  v_every int := public.setting_int('black_plus_every', 6);
  v_extra int;
  v_prize record;
  i int;
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    return;
  end if;

  for v_prize in
    select * from public.qualification_prizes
    where user_id = p_user and revoked_at is null and (v_acts < req_activations or v_pts < req_points)
  loop
    update public.qualification_prizes set revoked_at = now() where user_id = p_user and prize_key = v_prize.prize_key;
    update public.subscription_vouchers set status = 'revoked'
    where holder_id = p_user and prize_key = v_prize.prize_key and status = 'active';
    if v_prize.prize_key = v_prize.rank_key then
      delete from public.rank_achievements where user_id = p_user and rank_key = v_prize.rank_key;
    end if;
  end loop;

  for v_rule in select * from jsonb_array_elements(v_rules) loop
    if v_acts >= (v_rule ->> 'activations')::int and v_pts >= (v_rule ->> 'points')::int then
      insert into public.rank_achievements (user_id, rank_key, achieved_at) values (p_user, v_rule ->> 'key', now()) on conflict do nothing;
      perform public.grant_qualification_prize(p_user, v_rule ->> 'key', v_rule ->> 'key', (v_rule ->> 'vouchers')::int,
        v_rule ->> 'key' = 'diamond_star', (v_rule ->> 'activations')::int, (v_rule ->> 'points')::int);
    end if;
    if v_rule ->> 'key' = 'diamond_star' then
      v_black := v_rule;
    end if;
  end loop;

  if v_black is not null and v_every > 0
     and exists (select 1 from public.qualification_prizes where user_id = p_user and prize_key = 'diamond_star' and revoked_at is null) then
    v_extra := floor((v_acts - (v_black ->> 'activations')::int) / v_every::numeric)::int;
    for i in 1 .. greatest(v_extra, 0) loop
      perform public.grant_qualification_prize(p_user, 'black_plus_' || i, 'diamond_star', 1, false,
        (v_black ->> 'activations')::int + i * v_every, (v_black ->> 'points')::int);
    end loop;
  end if;
end;
$$;
revoke all on function public.evaluate_qualifications(uuid) from public, anon, authenticated;

-- Ogni giorno (cron): chi ha punti confermati negli ultimi 2 giorni viene
-- ricontrollato; restituisce i premi appena dati (per la notifica)
create or replace function public.evaluate_due_qualifications()
returns table (user_id uuid, prize_key text, rank_key text, vouchers integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_users uuid[];
  v_before text[];
  v_user uuid;
begin
  select array_agg(distinct a.user_id) into v_users from public.network_point_awards a
  where a.reversed_at is null
    and a.created_at <= public.points_confirm_cutoff()
    and a.created_at > public.points_confirm_cutoff() - interval '2 days';
  if v_users is null then
    return;
  end if;
  -- Premi già attivi prima del controllo: si restituiscono solo quelli nuovi
  select coalesce(array_agg(q.user_id::text || ':' || q.prize_key), '{}') into v_before
  from public.qualification_prizes q where q.user_id = any(v_users) and q.revoked_at is null;
  foreach v_user in array v_users loop
    perform public.evaluate_qualifications(v_user);
  end loop;
  return query
  select q.user_id, q.prize_key, q.rank_key, q.vouchers from public.qualification_prizes q
  where q.user_id = any(v_users) and q.revoked_at is null and not (q.user_id::text || ':' || q.prize_key = any(v_before));
end;
$$;
revoke all on function public.evaluate_due_qualifications() from public, anon, authenticated;
grant execute on function public.evaluate_due_qualifications() to service_role;

-- Spesa dei punti: solo quelli confermati
create or replace function public.spend_network_points(p_amount integer)
returns table (success boolean, new_network_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_network int;
  v_pending int;
begin
  if auth.uid() is null then
    return;
  end if;
  v_pending := public.pending_points_of(auth.uid());
  if p_amount is null or p_amount <= 0 then
    select coalesce(network_points, 0) into v_network from profiles where id = auth.uid();
    return query select false, v_network;
    return;
  end if;
  update profiles
  set network_points = network_points - p_amount
  where id = auth.uid() and coalesce(network_points, 0) - v_pending >= p_amount
  returning network_points into v_network;
  if not found then
    select coalesce(network_points, 0) into v_network from profiles where id = auth.uid();
    return query select false, v_network;
    return;
  end if;
  return query select true, v_network;
end;
$$;

-- Wallet: anche punti e attivazioni in conferma
drop function if exists public.my_network_wallet();
create function public.my_network_wallet()
returns table (
  network_points integer, earned_total integer, pending_points integer, confirmed_points integer,
  activations integer, pending_activations integer, confirm_days integer,
  qualifications jsonb, black_plus_every integer,
  points_activation_base integer, points_activation_pro integer, points_upgrade_pro integer,
  welcome_base integer, welcome_pro integer, welcome_from_direct integer, voucher_value_base_eur integer, voucher_value_pro_eur integer
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.network_points, 0), coalesce(p.network_points_earned_total, 0),
         public.pending_points_of(p.id), public.confirmed_points_of(p.id),
         public.paid_activations_of(p.id), public.pending_activations_of(p.id),
         public.setting_int('points_confirm_days', 15),
         public.qualification_rules(), public.setting_int('black_plus_every', 6),
         public.setting_int('network_points_activation_base', 10), public.setting_int('network_points_activation_pro', 120),
         public.setting_int('network_points_upgrade_pro', 110),
         public.setting_int('welcome_bonus_base', 1), public.setting_int('welcome_bonus_pro', 10), public.setting_int('welcome_bonus_from_direct', 6),
         public.setting_int('voucher_value_base_eur', 49), public.setting_int('voucher_value_pro_eur', 149)
  from public.profiles p
  where p.id = auth.uid();
$$;
revoke all on function public.my_network_wallet() from public, anon;
grant execute on function public.my_network_wallet() to authenticated;

-- Admin: chi ha raggiunto le qualifiche, con i dati per contattarli
create or replace function public.admin_qualified_members()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row order by (row ->> 'top_order')::int desc, row ->> 'top_at' asc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', p.email,
      'phone', p.phone,
      'city', p.city,
      'province', p.province,
      'country', p.country_code,
      'referral_code', p.referral_code,
      'plan', public.plan_of(p.id),
      'ranks', (select jsonb_object_agg(r.rank_key, r.achieved_at) from public.rank_achievements r where r.user_id = p.id),
      'top_order', (select max(case r.rank_key when 'diamond_star' then 3 when 'shining_star' then 2 else 1 end) from public.rank_achievements r where r.user_id = p.id),
      'top_at', (select max(r.achieved_at) from public.rank_achievements r where r.user_id = p.id),
      'activations', public.paid_activations_of(p.id),
      'confirmed_points', public.confirmed_points_of(p.id),
      'vouchers_total', (select count(*) from public.subscription_vouchers v where v.holder_id = p.id and v.prize_key is not null),
      'vouchers_used', (select count(*) from public.subscription_vouchers v where v.holder_id = p.id and v.prize_key is not null and v.status = 'redeemed'),
      'black_plus', (select count(*) from public.qualification_prizes q where q.user_id = p.id and q.prize_key like 'black_plus_%' and q.revoked_at is null)
    ) as row
    from public.profiles p
    where exists (select 1 from public.rank_achievements r where r.user_id = p.id)
      and p.deleted_at is null
  ) x;
$$;
revoke all on function public.admin_qualified_members() from public, anon, authenticated;
grant execute on function public.admin_qualified_members() to service_role;
