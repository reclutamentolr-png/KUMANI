-- «Scrivi cosa ti serve»: le richieste che non hanno trovato un servizio,
-- per migliorare le frasi della ricerca e scoprire servizi nuovi da creare.
-- Solo il testo scritto e la lingua (nessun dato della persona); si
-- cancellano dopo 180 giorni. Solo chiave di servizio (Admin).

create table if not exists public.need_search_misses (
  id uuid primary key default gen_random_uuid(),
  query text not null check (char_length(query) between 2 and 160),
  locale text,
  created_at timestamptz not null default now()
);
create index if not exists need_search_misses_at_idx on public.need_search_misses (created_at desc);
alter table public.need_search_misses enable row level security;
