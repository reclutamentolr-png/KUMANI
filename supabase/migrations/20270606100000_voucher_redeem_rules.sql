-- Attivazione dei voucher abbonamento (KV-/KVA-, codici omaggio, lotti per
-- negozianti) con le stesse regole dei regali (redeem_gift_code):
--  - con un abbonamento pagato con carta ancora attivo il codice non si usa
--    (si pagherebbe due volte e Stripe continuerebbe ad addebitare);
--  - piano già attivo con voucher/regalo/Admin: l'anno si aggiunge alla
--    scadenza (prima ripartiva da oggi e i mesi rimasti andavano persi);
--  - un voucher Plus su un Pro attivo non diventa un anno di Pro: il codice
--    resta valido per dopo o per qualcun altro;
--  - un voucher Pro su un Plus attivo passa subito a Pro, fino alla scadenza
--    più lontana tra quella attuale e un anno da oggi;
--  - codice annullato: «revoked» (prima risultava «già usato»).
-- Codici Pass: se il servizio è già incluso nel piano il codice non si
-- consuma (come per i regali).

create or replace function public.redeem_subscription_voucher(p_code text)
returns table (success boolean, reason text, new_expires_at timestamptz)
security definer
set search_path = public
language plpgsql
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_created_by uuid;
  v_status text;
  v_plan text;
  v_profile public.profiles%rowtype;
  v_active boolean;
  v_cur_plan text;
  v_expires timestamptz;
  v_new_plan text;
begin
  if v_uid is null then
    return;
  end if;

  select v.id, v.created_by, v.status, coalesce(v.plan, b.plan, 'base')
  into v_id, v_created_by, v_status, v_plan
  from public.subscription_vouchers v
  left join public.voucher_batches b on b.id = v.batch_id
  where v.code = upper(trim(p_code))
  for update of v;

  if v_id is null then
    return query select false, 'not_found', null::timestamptz;
    return;
  end if;

  if v_created_by = v_uid then
    return query select false, 'self_redemption', null::timestamptz;
    return;
  end if;

  if v_status = 'revoked' then
    return query select false, 'revoked', null::timestamptz;
    return;
  end if;

  if v_status <> 'active' then
    return query select false, 'already_used', null::timestamptz;
    return;
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found or coalesce(v_profile.is_blocked, false) then
    return query select false, 'not_allowed', null::timestamptz;
    return;
  end if;

  v_active := v_profile.subscription_status = 'active'
    and (v_profile.subscription_expires_at is null or v_profile.subscription_expires_at > now());
  v_cur_plan := coalesce(v_profile.subscription_plan, 'base');

  if v_active and v_profile.subscription_source = 'stripe' then
    return query select false, 'already_subscribed', null::timestamptz;
    return;
  end if;

  -- Attivo senza scadenza: un anno in più non aggiunge nulla
  if v_active and v_profile.subscription_expires_at is null then
    return query select false, 'already_active', null::timestamptz;
    return;
  end if;

  if v_active and v_cur_plan = 'pro' and v_plan <> 'pro' then
    return query select false, 'plan_mismatch', null::timestamptz;
    return;
  end if;

  if v_active and v_cur_plan = v_plan then
    v_expires := v_profile.subscription_expires_at + interval '1 year';
  elsif v_active then
    -- Plus attivo e voucher Pro: Pro da subito, senza perdere i mesi Plus
    v_expires := greatest(v_profile.subscription_expires_at, now() + interval '1 year');
  else
    v_expires := now() + interval '1 year';
  end if;
  v_new_plan := case when v_plan = 'pro' then 'pro' else 'base' end;

  update public.subscription_vouchers
  set status = 'redeemed', redeemed_by = v_uid, redeemed_at = now()
  where id = v_id and status = 'active';

  if not found then
    return query select false, 'already_used', null::timestamptz;
    return;
  end if;

  update public.profiles p
  set subscription_status = 'active',
      subscription_expires_at = v_expires,
      subscription_source = 'voucher',
      subscription_plan = v_new_plan
  where p.id = v_uid;

  return query select true, null::text, v_expires;
end;
$$;
revoke all on function public.redeem_subscription_voucher(text) from public, anon;
grant execute on function public.redeem_subscription_voucher(text) to authenticated;

create or replace function public.redeem_tool_pass_code(p_code text)
returns table(success boolean, reason text, tool text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_row public.tool_pass_codes%rowtype;
  v_expires timestamptz;
  v_required text;
  v_plan_now text;
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated', null::text, null::timestamptz;
    return;
  end if;
  select * into v_row from public.tool_pass_codes where code = upper(trim(p_code)) for update;
  if not found then
    return query select false, 'not_found', null::text, null::timestamptz;
    return;
  end if;
  if v_row.redeemed_at is not null then
    return query select false, 'already_used', v_row.tool, null::timestamptz;
    return;
  end if;
  if v_row.created_by = auth.uid() and not public.admin_has_permission(auth.uid(), '*') then
    return query select false, 'self_redemption', v_row.tool, null::timestamptz;
    return;
  end if;
  select s.required_plan into v_required from public.marketplace_settings s where s.tool_name = v_row.tool;
  if not found then
    return query select false, 'unknown_tool', v_row.tool, null::timestamptz;
    return;
  end if;
  -- Il servizio è già nel suo piano: il codice resta per qualcun altro
  v_plan_now := public.plan_of(auth.uid());
  if coalesce(v_required, 'base') = 'free'
     or (coalesce(v_required, 'base') = 'base' and v_plan_now in ('base', 'pro'))
     or (v_required = 'pro' and v_plan_now = 'pro') then
    return query select false, 'already_included', v_row.tool, null::timestamptz;
    return;
  end if;
  update public.tool_pass_codes set redeemed_by = auth.uid(), redeemed_at = now() where code = v_row.code;
  -- Il coupon nel Wallet di chi l'aveva ricevuto risulta usato
  update public.wallet_coupons set redeemed_at = now() where code = v_row.code and redeemed_at is null;
  v_expires := public.grant_tool_pass(auth.uid(), v_row.tool, v_row.days, 'code', null, null, 0, v_row.code);
  return query select true, null::text, v_row.tool, v_expires;
end;
$$;
revoke all on function public.redeem_tool_pass_code(text) from public, anon;
grant execute on function public.redeem_tool_pass_code(text) to authenticated;
