-- Link in Bio come privato o come azienda: con «azienda» la pagina pubblica
-- mostra nome, logo e città della Scheda attività invece di nome e cognome.
-- Solo per il piano Pro (la Scheda attività è del Pro): se il piano non è più
-- Pro la pagina torna a mostrare la persona. La tabella dà già a
-- authenticated i permessi di scrittura su tutte le colonne.
alter table public.link_in_bio add column if not exists mode text not null default 'personal' check (mode in ('personal', 'business'));
