-- KUMANI Sorpresa pagata con i punti: KU Karma (daily_points) oppure KU Points
-- confermati (network_points, mai quelli ancora in conferma). Il costo di
-- ogni tipo lo decide l'Admin (0 = non si può pagare con quei punti).
-- La sorpresa si attiva subito, come dopo il pagamento con la carta.

alter table public.surprise_gifts
  add column if not exists paid_with text check (paid_with in ('card', 'karma', 'ku_points')),
  add column if not exists points_spent integer check (points_spent is null or points_spent > 0),
  -- «Aperta» = link aperto da chi riceve; «Vista» (opened_at) = sorpresa vista
  add column if not exists link_opened_at timestamptz;
update public.surprise_gifts set link_opened_at = opened_at where opened_at is not null and link_opened_at is null;

-- Costi predefiniti, in proporzione ai prezzi (300 KU Karma = 5 € di sconto
-- sul rinnovo; 294 KU Points = voucher da 49 €)
insert into public.system_settings (key, value) values
  ('surprise_karma_voucher', '300'),
  ('surprise_karma_journey3', '1000'),
  ('surprise_karma_journey7', '1600'),
  ('surprise_kupoints_voucher', '18'),
  ('surprise_kupoints_journey3', '60'),
  ('surprise_kupoints_journey7', '96')
on conflict (key) do nothing;

-- Pagamento, stato e link li decide solo il server (ora anche come è stata pagata)
create or replace function public.surprise_gifts_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.public_token := null;
    new.paid_at := null;
    new.amount_cents := null;
    new.stripe_session_id := null;
    new.stripe_payment_intent := null;
    new.refunded_at := null;
    new.opened_at := null;
    new.link_opened_at := null;
    new.paid_with := null;
    new.points_spent := null;
  else
    new.status := old.status;
    new.public_token := old.public_token;
    new.paid_at := old.paid_at;
    new.amount_cents := old.amount_cents;
    new.stripe_session_id := old.stripe_session_id;
    new.stripe_payment_intent := old.stripe_payment_intent;
    new.refunded_at := old.refunded_at;
    new.opened_at := old.opened_at;
    new.link_opened_at := old.link_opened_at;
    new.paid_with := old.paid_with;
    new.points_spent := old.points_spent;
    new.user_id := old.user_id;
    if old.status = 'active' then
      new.kind := old.kind;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Costi in punti visibili a chi crea la sorpresa
create or replace function public.surprise_points_costs()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'karma', jsonb_build_object(
      'voucher', public.setting_int('surprise_karma_voucher', 300),
      'journey3', public.setting_int('surprise_karma_journey3', 1000),
      'journey7', public.setting_int('surprise_karma_journey7', 1600)),
    'ku_points', jsonb_build_object(
      'voucher', public.setting_int('surprise_kupoints_voucher', 18),
      'journey3', public.setting_int('surprise_kupoints_journey3', 60),
      'journey7', public.setting_int('surprise_kupoints_journey7', 96)));
$$;
revoke all on function public.surprise_points_costs() from public, anon;
grant execute on function public.surprise_points_costs() to authenticated;

-- p_currency: 'karma' oppure 'ku_points'. Tutto in un'unica transazione:
-- o si scalano i punti e la sorpresa si attiva, o non succede nulla.
create or replace function public.pay_surprise_with_points(p_gift_id uuid, p_currency text)
returns table (success boolean, reason text, points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_gift record;
  v_cost int;
  v_spend record;
begin
  if v_uid is null then
    return query select false, 'not_logged_in', 0;
    return;
  end if;
  if p_currency not in ('karma', 'ku_points') then
    return query select false, 'invalid', 0;
    return;
  end if;

  select g.id, g.kind, g.status, g.title, g.recipient_name into v_gift
  from public.surprise_gifts g
  where g.id = p_gift_id and g.user_id = v_uid
  for update;
  if not found then
    return query select false, 'not_found', 0;
    return;
  end if;
  if v_gift.status <> 'draft' then
    return query select false, 'already_active', 0;
    return;
  end if;
  if v_gift.kind not in ('voucher', 'journey3', 'journey7') or trim(coalesce(v_gift.title, '')) = '' or trim(coalesce(v_gift.recipient_name, '')) = '' then
    return query select false, 'incomplete', 0;
    return;
  end if;

  v_cost := coalesce((public.surprise_points_costs() -> p_currency ->> v_gift.kind)::int, 0);
  if v_cost <= 0 then
    return query select false, 'not_available', 0;
    return;
  end if;

  if p_currency = 'karma' then
    update public.profiles set daily_points = daily_points - v_cost
    where id = v_uid and coalesce(daily_points, 0) >= v_cost;
    if not found then
      return query select false, 'insufficient', v_cost;
      return;
    end if;
  else
    -- Solo i KU Points confermati
    select * into v_spend from public.spend_network_points(v_cost);
    if not coalesce(v_spend.success, false) then
      return query select false, 'insufficient', v_cost;
      return;
    end if;
  end if;

  update public.surprise_gifts
  set status = 'active',
      public_token = coalesce(public_token, replace(gen_random_uuid()::text, '-', '')),
      paid_at = now(),
      amount_cents = 0,
      paid_with = p_currency,
      points_spent = v_cost,
      start_at = coalesce(start_at, now())
  where id = v_gift.id;

  return query select true, null::text, v_cost;
end;
$$;
revoke all on function public.pay_surprise_with_points(uuid, text) from public, anon;
grant execute on function public.pay_surprise_with_points(uuid, text) to authenticated;
