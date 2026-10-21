-- Promozione di lancio: la tabella dei primi 50 non è più leggibile con la
-- chiave pubblica (mostrava codici utente e codici voucher). Il contatore e
-- la scheda «Sei tra i primi 50» la leggono dal server con la chiave di
-- servizio (lib/founders.ts, FounderCard, Admin).
drop policy if exists founder_members_read on public.founder_members;
revoke all on public.founder_members from anon, authenticated;
