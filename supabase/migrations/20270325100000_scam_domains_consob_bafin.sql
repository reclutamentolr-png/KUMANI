-- Elenchi di siti truffa: anche Consob (Italia, siti oscurati) e BaFin
-- (Germania, avvisi su siti non autorizzati), vedi /api/cron/scam-feeds.
alter table public.scam_domains drop constraint if exists scam_domains_source_check;
alter table public.scam_domains add constraint scam_domains_source_check
  check (source in ('amf', 'consob', 'bafin', 'phishdb', 'urlhaus'));
