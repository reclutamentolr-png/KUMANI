-- KUMANI LUMEN: le scelte usate per creare un copione con l'AI (argomento, a
-- chi, obiettivo, tono, durata, invito finale), per riaprirle con «Modifica»
-- e aggiornare il copione. Vuoto per i copioni scritti a mano.

alter table public.lumen_scripts
  add column if not exists ai_settings jsonb
  check (ai_settings is null or (jsonb_typeof(ai_settings) = 'object' and pg_column_size(ai_settings) <= 4096));
