-- KUMANI Shop, fase 1: preventivi accettati e pagati online.
-- Il venditore (piano Pro) collega il proprio conto Stripe (Stripe Connect,
-- conto Standard): il cliente paga direttamente il venditore, che resta il
-- venditore a tutti gli effetti (ricevute, rimborsi, contestazioni, fisco).
-- KUMANI può trattenere una commissione (system_settings
-- shop_commission_percent, 0 al lancio).

-- Conto Stripe collegato del venditore (scritto solo dal server)
create table if not exists public.seller_stripe_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.seller_stripe_accounts enable row level security;
drop policy if exists seller_stripe_accounts_own_read on public.seller_stripe_accounts;
create policy seller_stripe_accounts_own_read on public.seller_stripe_accounts for select to authenticated
  using (user_id = (select auth.uid()));

-- Preventivo: pagina pubblica, modo di pagamento, accettazione e pagamento
alter table public.quotes
  add column if not exists public_token text unique,
  add column if not exists payment_mode text not null default 'none' check (payment_mode in ('none', 'full', 'deposit')),
  add column if not exists deposit_percent smallint check (deposit_percent is null or deposit_percent between 1 and 100),
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by_name text check (accepted_by_name is null or char_length(accepted_by_name) <= 120),
  add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  add column if not exists paid_amount numeric(12,2),
  add column if not exists paid_at timestamptz,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

-- Accettazione e pagamento li scrive solo il server (pagina pubblica e
-- webhook di Stripe): il venditore non può segnare da sé «pagato»
create or replace function public.quotes_guard_payment()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and (
    new.accepted_at is distinct from old.accepted_at
    or new.accepted_by_name is distinct from old.accepted_by_name
    or new.payment_status is distinct from old.payment_status
    or new.paid_amount is distinct from old.paid_amount
    or new.paid_at is distinct from old.paid_at
    or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
    or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
  ) then
    raise exception 'quote_payment_locked';
  end if;
  return new;
end;
$$;
drop trigger if exists quotes_guard_payment on public.quotes;
create trigger quotes_guard_payment before update on public.quotes for each row execute function public.quotes_guard_payment();

-- Un preventivo nuovo (anche duplicato) parte sempre da zero
create or replace function public.quotes_reset_payment()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    new.public_token := null;
    new.accepted_at := null;
    new.accepted_by_name := null;
    new.payment_status := 'unpaid';
    new.paid_amount := null;
    new.paid_at := null;
    new.stripe_checkout_session_id := null;
    new.stripe_payment_intent_id := null;
  end if;
  return new;
end;
$$;
drop trigger if exists quotes_reset_payment on public.quotes;
create trigger quotes_reset_payment before insert on public.quotes for each row execute function public.quotes_reset_payment();

insert into public.system_settings (key, value)
values ('shop_commission_percent', '0')
on conflict (key) do nothing;

-- Pagina pubblica del preventivo: tutto ciò che serve per mostrarlo e
-- pagarlo, solo se il venditore ha ancora i Preventivi attivi
create or replace function public.get_public_quote(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'quote', jsonb_build_object(
      'id', q.id, 'quote_number', q.quote_number, 'client_name', q.client_name, 'client_email', q.client_email,
      'client_phone', q.client_phone, 'client_address', q.client_address, 'client_city', q.client_city,
      'client_postal_code', q.client_postal_code, 'client_vat', q.client_vat, 'client_pec', q.client_pec,
      'issue_date', q.issue_date, 'valid_until', q.valid_until, 'items', q.items, 'notes', q.notes, 'total', q.total,
      'payment_info', q.payment_info, 'layout', q.layout, 'logo_position', q.logo_position, 'subject', q.subject,
      'intro', q.intro, 'closing', q.closing, 'sections', q.sections, 'show_total', q.show_total, 'vat_mode', q.vat_mode,
      'signature', q.signature, 'band_style', q.band_style,
      'payment_mode', q.payment_mode, 'deposit_percent', q.deposit_percent, 'accepted_at', q.accepted_at,
      'accepted_by_name', q.accepted_by_name, 'payment_status', q.payment_status, 'paid_amount', q.paid_amount, 'paid_at', q.paid_at
    ),
    'issuer', (
      select jsonb_build_object(
        'company_name', i.company_name, 'vat_number', i.vat_number, 'address', i.address, 'city', i.city,
        'postal_code', i.postal_code, 'province', i.province, 'pec', i.pec, 'email', i.email, 'phone', i.phone, 'logo_path', i.logo_path, 'accent', i.accent
      ) from public.quote_issuer_profiles i where i.user_id = q.user_id
    ),
    'can_charge', exists (select 1 from public.seller_stripe_accounts s where s.user_id = q.user_id and s.charges_enabled)
  )
  from public.quotes q
  where q.public_token = p_token
    and length(p_token) >= 16
    and public.public_page_visible(q.user_id, 'preventivi')
$$;
grant execute on function public.get_public_quote(text) to anon, authenticated, service_role;
