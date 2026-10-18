-- Siti ufficiali da fonti pubbliche: li carica ogni notte /api/cron/scam-feeds
-- e Speculum li mostra come segnale positivo («sito ufficiale di …»).
--   ivass_company      = imprese di assicurazione vigilate dall'IVASS
--   ivass_intermediary = siti comunicati all'IVASS dagli intermediari iscritti al RUI
-- Una riga per dominio e fonte; nessun dato personale.

create table if not exists public.official_domains (
  domain text not null check (domain = lower(domain) and length(domain) between 3 and 253),
  source text not null check (source in ('ivass_company', 'ivass_intermediary')),
  name text,
  last_seen date not null default current_date,
  primary key (domain, source)
);

-- Solo il server (chiave di servizio) legge e scrive
alter table public.official_domains enable row level security;
revoke all on public.official_domains from anon, authenticated;
