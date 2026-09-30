-- Diritto di recesso (14 giorni) e consenso all'avvio immediato.
--
-- subscription_consents: prova del consenso dato prima di pagare (checkout
--   o passaggio a Pro): testo esatto mostrato, versione, momento.
-- withdrawal_requests: richieste di recesso inviate da /billing, gestite
--   dall'Admin (rimborso su Stripe + chiusura abbonamento, oppure rifiuto).
-- Entrambe si leggono e scrivono solo lato server (service role).

create table if not exists public.subscription_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('checkout', 'upgrade')),
  plan text not null check (plan in ('base', 'pro')),
  stripe_ref text,
  locale text,
  text_version text not null,
  consent_text text not null,
  created_at timestamptz not null default now()
);
create index if not exists subscription_consents_user_idx on public.subscription_consents (user_id, created_at desc);
alter table public.subscription_consents enable row level security;

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'refunded', 'rejected')),
  reason text check (char_length(reason) <= 1000),
  stripe_subscription_id text not null,
  -- Fatture pagate negli ultimi 14 giorni al momento della richiesta
  invoice_ids text[] not null default '{}',
  amount_cents integer not null default 0,
  -- Consenso all'avvio immediato dato al pagamento (rimborso proporzionale)
  consent_at timestamptz,
  requested_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references public.profiles(id) on delete set null,
  refund_mode text check (refund_mode in ('full', 'proportional')),
  refunded_cents integer,
  refund_ids text[] not null default '{}',
  admin_note text check (char_length(admin_note) <= 1000)
);
create index if not exists withdrawal_requests_user_idx on public.withdrawal_requests (user_id, requested_at desc);
create unique index if not exists withdrawal_requests_one_pending on public.withdrawal_requests (user_id) where status = 'pending';
alter table public.withdrawal_requests enable row level security;

-- Badge "Recessi" nel menu Admin: richieste in attesa non ancora viste
create or replace function public.admin_section_badges()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_default timestamptz := now() - interval '7 days';
  seen jsonb;
begin
  if v_uid is null or not public.admin_is_staff(v_uid) then
    return '{}'::jsonb;
  end if;
  select coalesce(jsonb_object_agg(section, seen_at), '{}'::jsonb) into seen from public.admin_section_seen where admin_id = v_uid;
  return jsonb_strip_nulls(jsonb_build_object(
    'users', nullif((select count(*) from public.profiles where created_at > coalesce((seen ->> 'users')::timestamptz, v_default)), 0),
    'profileRequests', nullif((select count(*) from public.profile_change_requests where status = 'pending' and created_at > coalesce((seen ->> 'profileRequests')::timestamptz, v_default)), 0),
    'accountDeletions', nullif((select count(*) from public.account_deletion_requests where status = 'pending' and requested_at > coalesce((seen ->> 'accountDeletions')::timestamptz, v_default)), 0),
    'withdrawals', nullif((select count(*) from public.withdrawal_requests where status = 'pending' and requested_at > coalesce((seen ->> 'withdrawals')::timestamptz, v_default)), 0),
    'listingReports', nullif((select count(*) from public.listing_reports where created_at > coalesce((seen ->> 'listingReports')::timestamptz, v_default)), 0),
    'spotlight', nullif((select count(*) from public.spotlight_profiles where moderation_status = 'pending' and updated_at > coalesce((seen ->> 'spotlight')::timestamptz, v_default)), 0),
    'affinity', nullif((select count(*) from public.affinity_reports where status = 'open' and created_at > coalesce((seen ->> 'affinity')::timestamptz, v_default)), 0),
    'convivio', nullif((select count(*) from public.convivio_reports where status = 'open' and created_at > coalesce((seen ->> 'convivio')::timestamptz, v_default))
                     + (select count(*) from public.convivio_groups where created_at > coalesce((seen ->> 'convivio')::timestamptz, v_default)), 0),
    'events', nullif((select count(*) from public.events where status = 'pending' and updated_at > coalesce((seen ->> 'events')::timestamptz, v_default))
                   + (select count(*) from public.event_reports where status = 'open' and created_at > coalesce((seen ->> 'events')::timestamptz, v_default))
                   + (select count(*) from public.events where status = 'published' and created_at > coalesce((seen ->> 'events')::timestamptz, v_default)), 0),
    'identity', nullif((select count(*) from public.identity_verifications where status = 'pending' and created_at > coalesce((seen ->> 'identity')::timestamptz, v_default)), 0),
    'convivioFees', nullif((select count(*) from public.convivio_fees where created_at > coalesce((seen ->> 'convivioFees')::timestamptz, v_default)), 0),
    'rewards', nullif((select count(*) from public.reward_redemptions where fulfilled_at is null and redeemed_at > coalesce((seen ->> 'rewards')::timestamptz, v_default)), 0),
    'contactMessages', nullif((select count(*) from public.contact_messages where status = 'new' and created_at > coalesce((seen ->> 'contactMessages')::timestamptz, v_default)), 0),
    'timebank', nullif((select count(*) from public.timebank_exchanges where status = 'disputed' and updated_at > coalesce((seen ->> 'timebank')::timestamptz, v_default))
                     + (select count(*) from public.timebank_reports where status = 'open' and created_at > coalesce((seen ->> 'timebank')::timestamptz, v_default)), 0),
    'mosaic', nullif((select count(*) from public.mosaic_reports where status = 'open' and created_at > coalesce((seen ->> 'mosaic')::timestamptz, v_default)), 0),
    'fabula', nullif((select count(*) from public.fabula_stories where status in ('pending', 'hidden') and updated_at > coalesce((seen ->> 'fabula')::timestamptz, v_default))
                   + (select count(*) from public.fabula_reports where status = 'open' and created_at > coalesce((seen ->> 'fabula')::timestamptz, v_default)), 0)
  ));
end;
$$;
