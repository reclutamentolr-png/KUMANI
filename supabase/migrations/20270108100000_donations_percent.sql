-- Donazioni in percentuale: per ogni abbonamento pagato (attivazione,
-- rinnovo o passaggio a Pro) KUMANI dona una percentuale di quanto incassato
-- davvero, impostata dall'Admin (prima: importi fissi 3 € Base / 6 € Pro).
-- I dati pubblici non mostrano più il totale maturato né gli importi per
-- piano (da cui si poteva risalire al numero di abbonati): solo quanto è già
-- stato versato all'associazione, con le ricevute, e i KU Points donati.

-- Percentuale in centesimi di punto (500 = 5,00%)
insert into public.system_settings (key, value)
values ('donation_percent_bp', '500')
on conflict (key) do nothing;

drop function if exists public.accrue_subscription_donation(text, uuid, text);

create or replace function public.accrue_subscription_donation(p_invoice_id text, p_user uuid, p_kind text, p_amount_paid_cents integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_bp int := public.setting_int('donation_percent_bp', 500);
  v_amount int;
  v_plan text;
  v_id uuid;
begin
  select id into v_association from public.donation_associations where is_active;
  if v_association is null or p_invoice_id is null or p_kind not in ('activation_base', 'renewal_base', 'activation_pro', 'renewal_pro', 'upgrade_pro') then
    return 0;
  end if;
  v_amount := round(greatest(coalesce(p_amount_paid_cents, 0), 0)::numeric * greatest(v_bp, 0) / 10000)::int;
  v_plan := case when p_kind like '%pro' then 'pro' else 'base' end;
  if v_amount <= 0 then
    return 0;
  end if;
  insert into public.donation_entries (association_id, source, user_id, amount_cents, plan, stripe_invoice_id)
  values (v_association, 'subscription', p_user, v_amount, v_plan, p_invoice_id)
  on conflict (stripe_invoice_id) do nothing
  returning id into v_id;
  return case when v_id is null then 0 else v_amount end;
end;
$$;
revoke all on function public.accrue_subscription_donation(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.accrue_subscription_donation(text, uuid, text, integer) to service_role;

-- Dati pubblici (Homepage, pagina Donazioni, Wallet): senza totale maturato
-- né importi per piano
create or replace function public.donation_public_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'percent_bp', public.setting_int('donation_percent_bp', 500),
    'point_value_cents', public.setting_int('donation_point_value_cents', 10),
    'points_cents', coalesce((select sum(amount_cents) from public.donation_entries where reversed_at is null and source = 'points'), 0),
    'paid_cents', coalesce((select sum(amount_cents) from public.donation_payouts), 0),
    'donors', (select count(distinct user_id) from public.donation_entries where reversed_at is null and source = 'points'),
    'active', (
      select jsonb_build_object('id', a.id, 'name', a.name, 'tax_code', a.tax_code, 'description', a.description,
                                'mission', a.mission, 'website', a.website, 'logo_url', a.logo_url,
                                'paid_cents', coalesce((select sum(p.amount_cents) from public.donation_payouts p where p.association_id = a.id), 0))
      from public.donation_associations a where a.is_active
    ),
    'associations', coalesce((
      select jsonb_agg(jsonb_build_object('name', a.name, 'website', a.website, 'is_active', a.is_active,
                                          'paid_cents', coalesce((select sum(p.amount_cents) from public.donation_payouts p where p.association_id = a.id), 0))
                       order by a.is_active desc, a.created_at desc)
      from public.donation_associations a
      where a.is_active or exists (select 1 from public.donation_payouts p where p.association_id = a.id)
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object('amount_cents', p.amount_cents, 'paid_on', p.paid_on, 'reference', p.reference,
                                          'receipt_url', p.receipt_url, 'association', a.name) order by p.paid_on desc)
      from public.donation_payouts p join public.donation_associations a on a.id = p.association_id
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.donation_public_summary() to anon, authenticated;
