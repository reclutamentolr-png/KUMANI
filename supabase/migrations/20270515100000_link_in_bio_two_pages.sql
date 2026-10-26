-- Link in Bio: due pagine distinte per chi ha il Pro. «personal» (indirizzo
-- /ref/<codice>/bio) e «business» (/ref/<codice>/bio/azienda), ognuna con i
-- suoi link, tema, testo e sottotitolo. Prima c'era una sola riga per utente:
-- quelle già salvate restano com'erano (mode dice di quale pagina sono).
-- La pagina «business» la salva e la mostra solo chi ha il Pro (controllo nel
-- salvataggio e nella pagina pubblica).
alter table public.link_in_bio drop constraint if exists link_in_bio_user_id_key;
alter table public.link_in_bio add constraint link_in_bio_user_mode_key unique (user_id, mode);
