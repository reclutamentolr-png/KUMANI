-- Admin → Invio Email: storico delle email inviate dallo Staff con gli
-- indirizzi support@, privacy@ e info@kumani.io. Solo il server (chiave di
-- servizio) legge e scrive: nessuna policy per gli utenti.
create table if not exists public.admin_sent_emails (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references auth.users (id) on delete set null,
  from_address text not null,
  to_addresses text[] not null,
  subject text not null,
  body text not null,
  sent_count int not null default 0,
  failed text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_sent_emails_created_idx on public.admin_sent_emails (created_at desc);
alter table public.admin_sent_emails enable row level security;
revoke all on public.admin_sent_emails from anon, authenticated;
