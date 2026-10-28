-- Google Calendar collegato con l'API (/calendario-collegato): KUMANI scrive gli
-- impegni in un calendario «KUMANI» creato nel Google dell'utente, subito dopo
-- ogni modifica. Il token di accesso è cifrato dal server (GOOGLE_TOKEN_KEY).
-- Scrive e legge solo il server con la chiave di servizio.
create table if not exists public.google_calendar_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  google_email text,
  calendar_id text,
  locale text not null default 'it',
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);

alter table public.google_calendar_links enable row level security;
revoke all on table public.google_calendar_links from anon, authenticated;
