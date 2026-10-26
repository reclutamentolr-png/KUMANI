-- Rete Anti-Truffa: racconto della truffa visibile a tutti gli iscritti
-- (elenco «Ultimi avvisi confermati» e avviso rosso nei controlli). È il testo
-- approvato dallo Staff, mai il nome o la città di chi ha segnalato. Vuoto =
-- nessun racconto mostrato.

alter table public.scam_targets add column if not exists public_story text;

-- Avvisi già confermati: il racconto dell'ultima segnalazione confermata
update public.scam_targets t
set public_story = (
  select r.description from public.scam_reports r
  where r.target_id = t.id and r.status = 'confirmed' and r.description is not null
  order by r.created_at desc
  limit 1
)
where t.status = 'confirmed' and t.public_story is null;
