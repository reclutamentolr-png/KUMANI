-- KUMANI Webinar: chi presenta spegne la videocamera di una persona e può
-- segnalare chi toglie dal webinar. Della connessione si tiene solo
-- un'impronta cifrata (non si può risalire all'indirizzo): se la stessa
-- impronta entra in un altro webinar, chi presenta viene avvisato.
alter table public.webinar_viewers add column if not exists cam_blocked boolean not null default false;
alter table public.webinar_viewers add column if not exists ip_hash text;

create table if not exists public.webinar_flags (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  webinar_id uuid references public.webinars(id) on delete set null,
  name text,
  created_at timestamptz not null default now()
);
create index if not exists webinar_flags_ip_hash_idx on public.webinar_flags (ip_hash);
-- Solo dal server (chiave di servizio): nessuna regola di lettura per il browser
alter table public.webinar_flags enable row level security;
