-- KU Points e qualifiche, regole nuove (ottobre 2026)
--
-- Punti a chi ha invitato:
--   - attivazione Base 10, Pro 120 (dal 1° al 5° invitato attivato);
--   - dal 6° in poi, se la persona finisce nella stella di un altro Kumano:
--     Base 9 + 1 a chi la accoglie, Pro 110 + 10 a chi la accoglie;
--   - passaggio da Base a Pro: 110, in proporzione a quanto pagato; se la
--     persona era stata accolta da un altro, la stessa proporzione del Pro
--     (101 a chi ha invitato + 9 a chi accoglie);
--   - Pass: i punti decisi per ogni servizio (non contano come attivazione).
-- Qualifiche (attivazioni Base/Pro pagate + KU Points guadagnati in totale,
-- compresi quelli ricevuti dalla struttura e dai Pass):
--   Kuman Green 6 + 60 → 1 voucher Base; Kuman Star 36 + 360 → 6 voucher Base;
--   Kuman Black 108 + 1080 → 18 voucher Base + 1 voucher Pro di un anno per sé.
--   Dopo Black: 1 voucher Base ogni 6 nuove attivazioni ("Black continuo").
-- I voucher premio arrivano da soli nel Wallet; si regalano (o si vendono,
-- sotto la responsabilità del Kumano). Le attivazioni fatte con un voucher
-- non danno punti né contano (contano solo quelle pagate con carta).
-- Spariscono i pacchetti voucher a punti (credito in euro).

-- 1. Impostazioni
insert into public.system_settings (key, value) values
  ('network_points_activation_base', '10'),
  ('network_points_activation_pro', '120'),
  ('network_points_upgrade_pro', '110'),
  ('welcome_bonus_base', '1'),
  ('welcome_bonus_pro', '10'),
  ('welcome_bonus_from_direct', '6'),
  ('qualifications', '[{"key":"rising_star","activations":6,"points":60,"vouchers":1},{"key":"shining_star","activations":36,"points":360,"vouchers":6},{"key":"diamond_star","activations":108,"points":1080,"vouchers":18}]'),
  ('black_plus_every', '6')
on conflict (key) do update set value = excluded.value;

create or replace function public.qualification_rules()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_agg(q order by (q ->> 'activations')::int)
     from jsonb_array_elements((select value::jsonb from public.system_settings where key = 'qualifications')) q
     where q ->> 'key' in ('rising_star', 'shining_star', 'diamond_star')),
    '[{"key":"rising_star","activations":6,"points":60,"vouchers":1},{"key":"shining_star","activations":36,"points":360,"vouchers":6},{"key":"diamond_star","activations":108,"points":1080,"vouchers":18}]'::jsonb
  );
$$;
grant execute on function public.qualification_rules() to anon, authenticated;

-- 2. Voucher premio: chi li tiene nel Wallet e per quale premio
alter table public.subscription_vouchers
  add column if not exists holder_id uuid references auth.users(id) on delete cascade,
  add column if not exists prize_key text;
create index if not exists subscription_vouchers_holder_idx on public.subscription_vouchers (holder_id);
drop policy if exists "Holder can view own vouchers" on public.subscription_vouchers;
create policy "Holder can view own vouchers" on public.subscription_vouchers for select to authenticated using (holder_id = (select auth.uid()));

create table if not exists public.qualification_prizes (
  user_id uuid not null references auth.users(id) on delete cascade,
  prize_key text not null,
  rank_key text not null,
  vouchers integer not null default 0,
  req_activations integer not null,
  req_points integer not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, prize_key)
);
alter table public.qualification_prizes enable row level security;
drop policy if exists qualification_prizes_select_own on public.qualification_prizes;
create policy qualification_prizes_select_own on public.qualification_prizes for select to authenticated using (user_id = (select auth.uid()));
grant select on public.qualification_prizes to authenticated;

-- Un voucher premio. p_self: voucher personale (Pro di Kuman Black) che il
-- Kumano può attivare per sé, quindi "creato" dall'account KUMANI.
create or replace function public.create_prize_voucher(p_holder uuid, p_plan text, p_prize_key text, p_self boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_creator uuid;
  v_attempt int := 0;
begin
  if p_self then
    begin
      v_creator := public.setting_text('house_account_id')::uuid;
    exception when others then
      v_creator := null;
    end;
    if v_creator is null or v_creator = p_holder then
      return null;
    end if;
  else
    v_creator := p_holder;
  end if;
  loop
    v_attempt := v_attempt + 1;
    v_code := 'KV-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '') from generate_series(1, 10));
    begin
      insert into public.subscription_vouchers (code, created_by, holder_id, status, plan, purpose, cost_cents, prize_key)
      values (v_code, v_creator, p_holder, 'active', p_plan, 'gift',
              case p_plan when 'pro' then public.setting_int('voucher_value_pro_eur', 149) else public.setting_int('voucher_value_base_eur', 49) end * 100,
              p_prize_key);
      return v_code;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'voucher_code_generation_failed';
      end if;
    end;
  end loop;
end;
$$;
revoke all on function public.create_prize_voucher(uuid, text, text, boolean) from public, anon, authenticated;

-- Premio dato una volta sola (di nuovo solo se era stato annullato)
create or replace function public.grant_qualification_prize(p_user uuid, p_prize_key text, p_rank_key text, p_vouchers int, p_pro_self boolean, p_req_activations int, p_req_points int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revoked timestamptz;
  i int;
begin
  select revoked_at into v_revoked from public.qualification_prizes where user_id = p_user and prize_key = p_prize_key for update;
  if found and v_revoked is null then
    return false;
  end if;
  if found then
    update public.qualification_prizes
    set revoked_at = null, granted_at = now(), vouchers = p_vouchers, req_activations = p_req_activations, req_points = p_req_points
    where user_id = p_user and prize_key = p_prize_key;
  else
    insert into public.qualification_prizes (user_id, prize_key, rank_key, vouchers, req_activations, req_points)
    values (p_user, p_prize_key, p_rank_key, p_vouchers, p_req_activations, p_req_points);
  end if;
  for i in 1 .. greatest(p_vouchers, 0) loop
    perform public.create_prize_voucher(p_user, 'base', p_prize_key, false);
  end loop;
  if p_pro_self then
    perform public.create_prize_voucher(p_user, 'pro', p_prize_key, true);
  end if;
  return true;
end;
$$;
revoke all on function public.grant_qualification_prize(uuid, text, text, int, boolean, int, int) from public, anon, authenticated;

-- Attivazioni pagate (Base o Pro) delle persone invitate, non stornate
create or replace function public.paid_activations_of(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct a.source_user_id)::int
  from public.network_point_awards a
  where a.user_id = p_user and a.kind in ('activation_base', 'activation_pro') and a.reversed_at is null;
$$;
revoke all on function public.paid_activations_of(uuid) from public, anon, authenticated;

-- Qualifiche e premi: si danno quando i requisiti sono raggiunti; dopo uno
-- storno (rimborso) si tolgono i premi i cui requisiti non valgono più
-- (voucher non ancora usati annullati, qualifica tolta).
create or replace function public.evaluate_qualifications(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rules jsonb := public.qualification_rules();
  v_acts int := public.paid_activations_of(p_user);
  v_pts int;
  v_rule jsonb;
  v_black jsonb;
  v_every int := public.setting_int('black_plus_every', 6);
  v_extra int;
  v_prize record;
  i int;
begin
  select coalesce(network_points_earned_total, 0) into v_pts from public.profiles where id = p_user;
  if not found then
    return;
  end if;

  -- Premi i cui requisiti (fissati quando sono stati dati) non valgono più
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

  -- Black continuo: 1 voucher ogni N nuove attivazioni dopo Kuman Black
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

-- Chi chiamava il calcolo dei badge ora calcola qualifiche e premi
create or replace function public.record_network_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluate_qualifications(p_user);
end;
$$;

-- 3. Punti delle attivazioni e del passaggio a Pro
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
  v_previous int;
  v_receiver uuid;
  v_welcome int := 0;
begin
  if p_kind not in ('activation_base', 'activation_pro', 'upgrade_pro') or p_invoice_id is null then
    return query select false, null::uuid, 0, null::uuid, 0;
    return;
  end if;

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
    -- Dal N° invitato attivato in poi, se la persona è nella stella di un altro
    select count(*) into v_previous
    from public.network_point_awards a
    where a.user_id = v_sponsor and a.kind in ('activation_base', 'activation_pro') and a.reversed_at is null
      and a.stripe_invoice_id is distinct from p_invoice_id;
    if v_previous + 1 >= public.setting_int('welcome_bonus_from_direct', 6) then
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

-- Rimborso: punti tolti e qualifiche/premi ricontrollati
create or replace function public.reverse_activation_points(p_invoice_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.network_point_awards;
begin
  update public.network_point_awards
  set reversed_at = now()
  where stripe_invoice_id = p_invoice_id and reversed_at is null
  returning * into v_row;
  if v_row.id is null then
    return 0;
  end if;
  update public.profiles
  set network_points = greatest(coalesce(network_points, 0) - v_row.points, 0),
      network_points_earned_total = greatest(coalesce(network_points_earned_total, 0) - v_row.points, 0)
  where id = v_row.user_id;
  perform public.evaluate_qualifications(v_row.user_id);
  return v_row.points;
end;
$$;
revoke all on function public.reverse_activation_points(text) from public, anon, authenticated;
grant execute on function public.reverse_activation_points(text) to service_role;

-- 4. Wallet: punti, attivazioni, regole e qualifiche (niente più pacchetti)
drop function if exists public.my_network_wallet();
create function public.my_network_wallet()
returns table (
  network_points integer, earned_total integer, activations integer, qualifications jsonb, black_plus_every integer,
  points_activation_base integer, points_activation_pro integer, points_upgrade_pro integer,
  welcome_base integer, welcome_pro integer, welcome_from_direct integer, voucher_value_base_eur integer, voucher_value_pro_eur integer
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.network_points, 0), coalesce(p.network_points_earned_total, 0), public.paid_activations_of(p.id),
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

-- 5. Via i pacchetti voucher a punti e il credito
drop function if exists public.redeem_voucher_pack(integer);
drop function if exists public.create_subscription_voucher(text, text, integer);
drop function if exists public.cancel_my_voucher(uuid);
drop function if exists public.voucher_packs();
