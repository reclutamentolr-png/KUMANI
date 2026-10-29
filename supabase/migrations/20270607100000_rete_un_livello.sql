-- Programma inviti a un solo livello, premi solo in servizi KUMANI (in vista
-- della verifica di Stripe, che non accetta il multilivello «con commissioni o
-- vendite basate sul reclutamento»):
--  A. i KU Points di un'attivazione pagata vanno solo a chi ha invitato
--     direttamente la persona: niente più Bonus Accoglienza a chi la accoglie
--     nella sua stella, niente bonus per i posti della stella riempiti da
--     altri (claim_matrix_slot_bonus non si può più chiamare);
--  B. i voucher non si vendono: si usano o si regalano (purpose solo 'gift'
--     o 'promo'; al 29/10/2026 nessun voucher risultava venduto);
--  C. i premi restano servizi KUMANI (voucher, Pass), mai denaro.
-- La stella resta com'è: chi entra e dove si vede non cambia, cambia solo
-- chi riceve i punti.

-- A. Punti solo a chi ha invitato (stessa firma: welcome_user resta vuoto)
create or replace function public.award_activation_points(p_invoice_id text, p_customer uuid, p_kind text, p_scale numeric default 1)
returns table(awarded boolean, sponsor_id uuid, points integer, welcome_user uuid, welcome_points integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sponsor uuid;
  v_points int;
  v_scale numeric := least(greatest(coalesce(p_scale, 1), 0), 1);
  v_house text := public.setting_text('house_account_id');
  v_id uuid;
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

  insert into public.network_point_awards (user_id, source_user_id, kind, points, stripe_invoice_id)
  values (v_sponsor, p_customer, p_kind, v_points, p_invoice_id)
  on conflict (stripe_invoice_id) do nothing
  returning id into v_id;
  if v_id is null then
    return query select false, v_sponsor, 0, null::uuid, 0;
    return;
  end if;

  update public.profiles
  set network_points = coalesce(network_points, 0) + v_points,
      network_points_earned_total = coalesce(network_points_earned_total, 0) + v_points
  where id = v_sponsor;
  perform public.evaluate_qualifications(v_sponsor);

  return query select true, v_sponsor, v_points, null::uuid, 0;
end;
$$;

-- Bonus Accoglienza e bonus dei posti a zero anche nelle impostazioni (così
-- le pagine che li mostrano non indicano quote che non esistono più)
update public.system_settings set value = '0' where key in ('welcome_bonus_base', 'welcome_bonus_pro', 'matrix_slot_bonus_points', 'matrix_spillover_bonus_points');

-- Bonus dei posti della stella: non più richiamabile dall'app
revoke execute on function public.claim_matrix_slot_bonus() from public, anon, authenticated;

-- B. Voucher solo da usare o regalare
alter table public.subscription_vouchers drop constraint if exists subscription_vouchers_purpose_check;
alter table public.subscription_vouchers
  add constraint subscription_vouchers_purpose_check check (purpose in ('gift', 'promo'));
alter table public.subscription_vouchers drop constraint if exists subscription_vouchers_no_sale;
alter table public.subscription_vouchers
  add constraint subscription_vouchers_no_sale check (sale_price_cents is null and buyer_name is null and sold_at is null);
