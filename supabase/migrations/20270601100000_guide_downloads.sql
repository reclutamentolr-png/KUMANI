-- Manuale Antitruffa: ogni volta che qualcuno lo scarica in PDF o lo apre per
-- stamparlo (/api/antitruffa/manuale). Lo Staff vede i numeri in Admin.
-- Scrive e legge solo il server con la chiave di servizio.
create table if not exists public.guide_downloads (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  locale text not null,
  mode text not null check (mode in ('pdf', 'print'))
);

create index if not exists guide_downloads_created_idx on public.guide_downloads (created_at desc);

alter table public.guide_downloads enable row level security;
revoke all on table public.guide_downloads from anon, authenticated;
