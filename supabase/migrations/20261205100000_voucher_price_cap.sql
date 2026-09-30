-- Prezzo di vendita dei voucher: al massimo il valore del voucher (Base 49 €,
-- Pro 149 €, o i valori delle impostazioni). Controllato alla creazione e,
-- per le modifiche successive (ricevuta), da un vincolo sulla tabella.

alter table public.subscription_vouchers drop constraint if exists subscription_vouchers_sale_price_max;
alter table public.subscription_vouchers
  add constraint subscription_vouchers_sale_price_max
  check (sale_price_cents is null or cost_cents is null or sale_price_cents <= cost_cents);

create or replace function public.create_subscription_voucher(p_plan text, p_purpose text, p_price_cents integer)
returns table (success boolean, reason text, code text, new_credit_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost int;
  v_credit int;
  v_code text;
  v_id uuid;
  v_attempt int := 0;
begin
  if auth.uid() is null then
    return;
  end if;
  if p_plan not in ('base', 'pro') or p_purpose not in ('gift', 'sale') or (p_price_cents is not null and p_price_cents < 0) then
    return query select false, 'invalid', null::text, coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  v_cost := case p_plan when 'pro' then public.setting_int('voucher_value_pro_eur', 149) else public.setting_int('voucher_value_base_eur', 49) end * 100;

  -- Prezzo di vendita mai oltre il valore del voucher
  if p_purpose = 'sale' and p_price_cents is not null and p_price_cents > v_cost then
    return query select false, 'price_too_high', null::text, coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  update profiles set voucher_credit_cents = voucher_credit_cents - v_cost
  where id = auth.uid() and voucher_credit_cents >= v_cost
  returning voucher_credit_cents into v_credit;
  if not found then
    return query select false, 'insufficient_credit', null::text, coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'KV-' || (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
      from generate_series(1, 10)
    );
    begin
      insert into subscription_vouchers (code, created_by, status, plan, purpose, sale_price_cents, cost_cents)
      values (v_code, auth.uid(), 'active', p_plan, p_purpose, case when p_purpose = 'sale' then p_price_cents end, v_cost)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'voucher_code_generation_failed';
      end if;
    end;
  end loop;

  insert into public.voucher_credit_movements (user_id, kind, cents, voucher_id) values (auth.uid(), 'voucher', -v_cost, v_id);
  return query select true, null::text, v_code, v_credit;
end;
$$;

grant execute on function public.create_subscription_voucher(text, text, integer) to authenticated;
