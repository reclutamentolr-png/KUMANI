-- Siti segnalati da fonti esterne (non dalla community): li carica ogni notte
-- /api/cron/scam-feeds e Speculum li cerca nel controllo dei siti.
--   amf      = Autorité des marchés financiers (Francia), liste nere ufficiali
--              (Licence Ouverte 2.0, data.gouv.fr): restano finché sono in elenco
--   phishdb  = Phishing.Database (licenza MIT): siti di phishing attivi, solo
--              domini europei o che imitano banche, poste, corrieri… (scadono)
--   urlhaus  = URLhaus di abuse.ch (CC0): siti che distribuiscono virus (scadono)
-- Una riga per dominio e fonte; nessun dato personale.

create table if not exists public.scam_domains (
  domain text not null check (domain = lower(domain) and length(domain) between 3 and 253),
  source text not null check (source in ('amf', 'phishdb', 'urlhaus')),
  category text,
  listed_on date,
  last_seen date not null default current_date,
  expires_on date,
  primary key (domain, source)
);
create index if not exists scam_domains_expires on public.scam_domains(expires_on) where expires_on is not null;

-- Solo il server (chiave di servizio) legge e scrive
alter table public.scam_domains enable row level security;
revoke all on public.scam_domains from anon, authenticated;
