-- Registro delle impersonificazioni dello Staff: chi è entrato nell'account
-- di chi, e quando. Scritto solo dal server (chiave di servizio) in
-- impersonateUser(); nessuno lo legge o modifica dal browser.
-- Da eseguire PRIMA di pubblicare il codice: senza questa tabella
-- l'impersonificazione viene rifiutata (per sicurezza, niente accessi non
-- registrati).
create table if not exists public.admin_impersonations (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists admin_impersonations_created_idx on public.admin_impersonations (created_at desc);
create index if not exists admin_impersonations_target_idx on public.admin_impersonations (target_id, created_at desc);

alter table public.admin_impersonations enable row level security;
revoke all on public.admin_impersonations from anon, authenticated;
