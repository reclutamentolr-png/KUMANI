-- Rete Anti-Truffa: nuova categoria «Giochi online» (falsi casinò e
-- scommesse, spesso in criptovalute, che bloccano i prelievi e chiedono un
-- «deposito di verifica»). scam_targets.category è testo libero; il vincolo
-- da allargare è quello delle segnalazioni.

alter table public.scam_reports drop constraint if exists scam_reports_category_check;
alter table public.scam_reports
  add constraint scam_reports_category_check
  check (category in ('courier', 'bank', 'investment', 'gaming', 'romance', 'rental', 'marketplace', 'job', 'support', 'prize', 'phishing', 'other'));
