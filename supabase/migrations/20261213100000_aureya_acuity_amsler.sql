-- Aureya: il test del campo visivo è sostituito da due nuovi test senza
-- tempi di reazione: acuità visiva (la "E" di Snellen) e griglia di Amsler.
-- I vecchi risultati 'visual' restano nella cronologia.
alter table public.aureya_test_results drop constraint if exists aureya_test_results_test_type_check;
alter table public.aureya_test_results
  add constraint aureya_test_results_test_type_check
  check (test_type in ('acoustic', 'visual', 'acuity', 'amsler'));
