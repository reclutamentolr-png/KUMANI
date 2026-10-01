-- Donazioni KUMANI (Cause-Related Marketing)
--
-- - Per ogni pagamento con carta di un abbonamento (primo pagamento e rinnovi)
--   KUMANI dona una cifra fissa all'associazione attiva: Base 3 €, Pro 6 €;
--   il passaggio da Base a Pro aggiunge la differenza (3 €). Un rimborso la
--   annulla. I voucher (nessun incasso) non contano.
-- - Ogni Kumano può donare Punti Community: KUMANI versa il controvalore in
--   euro (valore per punto deciso dall'Admin).
-- - Una sola associazione attiva alla volta; le precedenti restano nello
--   storico. I versamenti (bonifici) li registra l'Admin: il sito mostra
--   quanto è maturato e quanto è già stato versato.
-- - La vecchia "Donazione solidale" dei KU viene spenta.

-- ---------------------------------------------------------------------------
-- Impostazioni
-- ---------------------------------------------------------------------------
insert into public.system_settings (key, value) values
  ('donation_base_cents', '300'),
  ('donation_pro_cents', '600'),
  ('donation_point_value_cents', '10')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Associazioni beneficiarie
-- ---------------------------------------------------------------------------
create table if not exists public.donation_associations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  tax_code text check (char_length(tax_code) <= 32),
  description text check (char_length(description) <= 2000),
  mission text check (char_length(mission) <= 300),
  website text check (char_length(website) <= 300),
  logo_url text check (char_length(logo_url) <= 600),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists donation_associations_one_active on public.donation_associations ((is_active)) where is_active;
alter table public.donation_associations enable row level security;

-- ---------------------------------------------------------------------------
-- Registro delle donazioni maturate
-- ---------------------------------------------------------------------------
create table if not exists public.donation_entries (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.donation_associations(id) on delete restrict,
  source text not null check (source in ('subscription', 'points')),
  user_id uuid references public.profiles(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  points integer check (points > 0),
  plan text check (plan in ('base', 'pro')),
  stripe_invoice_id text unique,
  reversed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists donation_entries_association_idx on public.donation_entries (association_id, created_at desc);
create index if not exists donation_entries_user_idx on public.donation_entries (user_id, created_at desc);
alter table public.donation_entries enable row level security;

-- ---------------------------------------------------------------------------
-- Versamenti all'associazione (bonifici fatti da KUMANI)
-- ---------------------------------------------------------------------------
create table if not exists public.donation_payouts (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.donation_associations(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  paid_on date not null,
  reference text check (char_length(reference) <= 200),
  receipt_url text check (char_length(receipt_url) <= 600),
  notes text check (char_length(notes) <= 1000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists donation_payouts_association_idx on public.donation_payouts (association_id, paid_on desc);
alter table public.donation_payouts enable row level security;

-- ---------------------------------------------------------------------------
-- Donazione per un pagamento con carta (webhook Stripe, chiave di servizio).
-- p_kind: activation_base | activation_pro | renewal_base | renewal_pro | upgrade_pro
-- ---------------------------------------------------------------------------
create or replace function public.accrue_subscription_donation(p_invoice_id text, p_user uuid, p_kind text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_base int := public.setting_int('donation_base_cents', 300);
  v_pro int := public.setting_int('donation_pro_cents', 600);
  v_amount int;
  v_plan text;
  v_id uuid;
begin
  select id into v_association from public.donation_associations where is_active;
  if v_association is null or p_invoice_id is null then
    return 0;
  end if;
  v_amount := case p_kind
    when 'activation_base' then v_base
    when 'renewal_base' then v_base
    when 'activation_pro' then v_pro
    when 'renewal_pro' then v_pro
    when 'upgrade_pro' then greatest(v_pro - v_base, 0)
    else 0
  end;
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
revoke all on function public.accrue_subscription_donation(text, uuid, text) from public, anon, authenticated;
grant execute on function public.accrue_subscription_donation(text, uuid, text) to service_role;

-- Rimborso: la donazione collegata a quella fattura viene annullata
create or replace function public.reverse_subscription_donation(p_invoice_id text)
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.donation_entries set reversed_at = now()
    where stripe_invoice_id = p_invoice_id and reversed_at is null
    returning amount_cents
  )
  select coalesce(sum(amount_cents), 0)::int from updated;
$$;
revoke all on function public.reverse_subscription_donation(text) from public, anon, authenticated;
grant execute on function public.reverse_subscription_donation(text) to service_role;

-- ---------------------------------------------------------------------------
-- Donazione di Punti Community da parte del Kumano
-- ---------------------------------------------------------------------------
create or replace function public.donate_network_points(p_points integer)
returns table (success boolean, reason text, amount_cents integer, new_network_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_value int := public.setting_int('donation_point_value_cents', 10);
  v_spend record;
begin
  if auth.uid() is null then
    return;
  end if;
  select id into v_association from public.donation_associations where is_active;
  if v_association is null or v_value <= 0 then
    return query select false, 'disabled', 0, coalesce((select network_points from profiles where id = auth.uid()), 0);
    return;
  end if;
  if p_points is null or p_points < 1 or p_points > 1000000 then
    return query select false, 'invalid_amount', 0, coalesce((select network_points from profiles where id = auth.uid()), 0);
    return;
  end if;
  select * into v_spend from public.spend_network_points(p_points);
  if not v_spend.success then
    return query select false, 'insufficient_points', 0, v_spend.new_network_points;
    return;
  end if;
  insert into public.donation_entries (association_id, source, user_id, amount_cents, points)
  values (v_association, 'points', auth.uid(), p_points * v_value, p_points);
  return query select true, null::text, p_points * v_value, v_spend.new_network_points;
end;
$$;
revoke all on function public.donate_network_points(integer) from public, anon;
grant execute on function public.donate_network_points(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Dati pubblici: Homepage, pagina Donazioni, dashboard
-- ---------------------------------------------------------------------------
create or replace function public.donation_public_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'base_cents', public.setting_int('donation_base_cents', 300),
    'pro_cents', public.setting_int('donation_pro_cents', 600),
    'point_value_cents', public.setting_int('donation_point_value_cents', 10),
    'accrued_cents', coalesce((select sum(amount_cents) from public.donation_entries where reversed_at is null), 0),
    'subscription_cents', coalesce((select sum(amount_cents) from public.donation_entries where reversed_at is null and source = 'subscription'), 0),
    'points_cents', coalesce((select sum(amount_cents) from public.donation_entries where reversed_at is null and source = 'points'), 0),
    'paid_cents', coalesce((select sum(amount_cents) from public.donation_payouts), 0),
    'donors', (select count(distinct user_id) from public.donation_entries where reversed_at is null and source = 'points'),
    'active', (
      select jsonb_build_object('id', a.id, 'name', a.name, 'tax_code', a.tax_code, 'description', a.description,
                                'mission', a.mission, 'website', a.website, 'logo_url', a.logo_url,
                                'accrued_cents', coalesce((select sum(e.amount_cents) from public.donation_entries e where e.association_id = a.id and e.reversed_at is null), 0),
                                'paid_cents', coalesce((select sum(p.amount_cents) from public.donation_payouts p where p.association_id = a.id), 0))
      from public.donation_associations a where a.is_active
    ),
    'associations', coalesce((
      select jsonb_agg(jsonb_build_object('name', a.name, 'website', a.website, 'is_active', a.is_active,
                                          'accrued_cents', coalesce((select sum(e.amount_cents) from public.donation_entries e where e.association_id = a.id and e.reversed_at is null), 0),
                                          'paid_cents', coalesce((select sum(p.amount_cents) from public.donation_payouts p where p.association_id = a.id), 0))
                       order by a.is_active desc, a.created_at desc)
      from public.donation_associations a
      where a.is_active or exists (select 1 from public.donation_entries e where e.association_id = a.id)
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object('amount_cents', p.amount_cents, 'paid_on', p.paid_on, 'reference', p.reference,
                                          'receipt_url', p.receipt_url, 'association', a.name) order by p.paid_on desc)
      from public.donation_payouts p join public.donation_associations a on a.id = p.association_id
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.donation_public_summary() to anon, authenticated;

-- Le donazioni di punti del Kumano e il totale (per il Portafoglio)
create or replace function public.my_donations()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_points', coalesce((select sum(points) from public.donation_entries where user_id = auth.uid() and source = 'points' and reversed_at is null), 0),
    'total_cents', coalesce((select sum(amount_cents) from public.donation_entries where user_id = auth.uid() and source = 'points' and reversed_at is null), 0),
    'subscription_cents', coalesce((select sum(amount_cents) from public.donation_entries where user_id = auth.uid() and source = 'subscription' and reversed_at is null), 0),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('points', e.points, 'amount_cents', e.amount_cents, 'created_at', e.created_at, 'association', a.name) order by e.created_at desc)
      from (select * from public.donation_entries where user_id = auth.uid() and source = 'points' and reversed_at is null order by created_at desc limit 50) e
      join public.donation_associations a on a.id = e.association_id
    ), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;
grant execute on function public.my_donations() to authenticated;

-- ---------------------------------------------------------------------------
-- Vecchia donazione dei KU: spenta e non più eseguibile
-- ---------------------------------------------------------------------------
update public.ku_features set enabled = false where key = 'donation';
revoke execute on function public.donate_ku(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sconto rinnovo e conversione KU: un'operazione alla volta per utente (due
-- clic contemporanei non superano più i limiti annuale/mensile)
-- ---------------------------------------------------------------------------
create or replace function public.reserve_renewal_discount()
returns table (success boolean, reason text, transaction_id uuid, discount_eur integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_config jsonb := public.ku_feature_config('renewal_discount');
  v_cost int;
  v_discount int;
  v_max int;
  v_used int;
  v_id uuid;
begin
  if auth.uid() is null then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('ku:' || auth.uid()::text));
  if v_config is null then
    return query select false, 'disabled', null::uuid, 0; return;
  end if;
  v_cost := coalesce((v_config ->> 'cost_ku')::int, 0);
  v_discount := coalesce((v_config ->> 'discount_eur')::int, 0);
  v_max := coalesce((v_config ->> 'max_per_year')::int, 1);
  if v_cost <= 0 or v_discount <= 0 then
    return query select false, 'disabled', null::uuid, 0; return;
  end if;

  if not exists (
    select 1 from profiles
    where id = auth.uid() and subscription_status = 'active' and subscription_source = 'stripe'
      and (subscription_expires_at is null or subscription_expires_at > now())
  ) then
    return query select false, 'no_stripe_subscription', null::uuid, 0; return;
  end if;

  select count(*) into v_used from ku_transactions
  where user_id = auth.uid() and kind = 'renewal_discount'
    and created_at > now() - interval '365 days'
    and coalesce(details ->> 'status', '') <> 'failed';
  if v_used >= v_max then
    return query select false, 'limit_reached', null::uuid, 0; return;
  end if;

  if not public.ku_spend(auth.uid(), v_cost) then
    return query select false, 'insufficient_points', null::uuid, 0; return;
  end if;

  insert into ku_transactions (user_id, kind, ku_amount, details)
    values (auth.uid(), 'renewal_discount', v_cost, jsonb_build_object('status', 'pending', 'discount_eur', v_discount))
    returning id into v_id;
  return query select true, null::text, v_id, v_discount;
end;
$$;
revoke all on function public.reserve_renewal_discount() from public, anon;
grant execute on function public.reserve_renewal_discount() to authenticated;

create or replace function public.convert_ku_to_network_points(p_points integer)
returns table (success boolean, reason text, new_daily_points integer, new_network_points integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_config jsonb := public.ku_feature_config('conversion');
  v_rate int;
  v_max int;
  v_used int;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  v_daily int;
  v_network int;
begin
  if auth.uid() is null then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('ku:' || auth.uid()::text));
  select coalesce(daily_points, 0), coalesce(network_points, 0) into v_daily, v_network from profiles where id = auth.uid();
  if v_config is null then
    return query select false, 'disabled', v_daily, v_network; return;
  end if;
  v_rate := coalesce((v_config ->> 'ku_per_point')::int, 0);
  v_max := coalesce((v_config ->> 'max_points_per_month')::int, 0);
  if v_rate <= 0 or v_max <= 0 or p_points is null or p_points <= 0 then
    return query select false, 'invalid_amount', v_daily, v_network; return;
  end if;

  select coalesce(sum((details ->> 'points')::int), 0) into v_used from ku_transactions
  where user_id = auth.uid() and kind = 'conversion' and created_at >= v_month_start;
  if v_used + p_points > v_max then
    return query select false, 'limit_reached', v_daily, v_network; return;
  end if;

  if not public.ku_spend(auth.uid(), p_points * v_rate) then
    return query select false, 'insufficient_points', v_daily, v_network; return;
  end if;

  update profiles set network_points = coalesce(network_points, 0) + p_points where id = auth.uid()
    returning daily_points, network_points into v_daily, v_network;
  insert into ku_transactions (user_id, kind, ku_amount, details)
    values (auth.uid(), 'conversion', p_points * v_rate, jsonb_build_object('points', p_points));
  return query select true, null::text, v_daily, v_network;
end;
$$;
revoke all on function public.convert_ku_to_network_points(integer) from public, anon;
grant execute on function public.convert_ku_to_network_points(integer) to authenticated;
