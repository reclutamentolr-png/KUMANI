-- Elenchi di siti truffa: anche IVASS (Italia, siti di assicurazioni abusivi
-- oscurati o segnalati), vedi /api/cron/scam-feeds.
alter table public.scam_domains drop constraint if exists scam_domains_source_check;
alter table public.scam_domains add constraint scam_domains_source_check
  check (source in ('amf', 'consob', 'bafin', 'ivass', 'phishdb', 'urlhaus'));
