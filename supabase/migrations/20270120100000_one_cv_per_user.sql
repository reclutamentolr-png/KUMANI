-- KUMANI CV: un solo CV per persona (niente CV fittizi; chi vuole più
-- versioni modifica il proprio). Oggi c'è al massimo un CV per utente.
create unique index if not exists cvs_one_per_user on public.cvs (user_id);
