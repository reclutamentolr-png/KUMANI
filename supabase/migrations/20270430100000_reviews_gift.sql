-- Recensioni anche da chi ha una licenza omaggio (codice regalo dello Staff,
-- es. i primi 50 Fondatori): può recensire come gli abbonati, sempre dopo
-- 7 giorni d'uso, ma la recensione lo dice chiaramente («Licenza omaggio»)
-- invece di «Acquisto verificato». Le licenze vendute restano «base»/«pro».

alter table public.reviews drop constraint if exists reviews_purchase_label_check;
alter table public.reviews
  add constraint reviews_purchase_label_check check (purchase_label in ('base', 'pro', 'pass', 'gift'));

create or replace function public.review_purchase_label(p_uid uuid, p_subject text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p record;
  v_paid boolean;
  v_gift boolean;
  v_plan text;
  v_required text;
begin
  select subscription_status, subscription_source, subscription_plan, subscription_expires_at, subscription_started_at, deleted_at
    into p from public.profiles where id = p_uid;
  if not found or p.deleted_at is not null then
    return null;
  end if;
  v_plan := coalesce(p.subscription_plan, 'base');
  v_paid := p.subscription_status = 'active'
    and p.subscription_source in ('stripe', 'voucher')
    and (p.subscription_expires_at is null or p.subscription_expires_at > now())
    and coalesce(p.subscription_started_at, now()) <= now() - interval '7 days';
  -- Abbonamento attivato con un codice regalato (non venduto): l'ultimo codice usato
  v_gift := p.subscription_source = 'voucher' and coalesce((
    select v.purpose in ('gift', 'promo') from public.subscription_vouchers v
    where v.redeemed_by = p_uid and v.status = 'redeemed'
    order by v.redeemed_at desc nulls last limit 1
  ), false);

  if p_subject = 'kumani' then
    return case when v_paid then (case when v_gift then 'gift' else v_plan end) end;
  end if;

  select required_plan into v_required from public.marketplace_settings where tool_name = p_subject and is_enabled;
  if v_required is null or v_required not in ('base', 'pro') then
    return null;
  end if;
  if v_paid and (v_required = 'base' or v_plan = 'pro') then
    return case when v_gift then 'gift' else v_plan end;
  end if;
  if exists (
    select 1 from public.tool_passes
    where user_id = p_uid and tool = p_subject and revoked_at is null
      and source = 'stripe' and coalesce(amount_cents, 0) > 0
      and starts_at <= now() - interval '7 days'
  ) then
    return 'pass';
  end if;
  return null;
end;
$$;
revoke all on function public.review_purchase_label(uuid, text) from public, anon, authenticated;
