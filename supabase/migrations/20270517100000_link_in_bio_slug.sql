-- Link in Bio con un nome scelto: kumani.io/bio/<nome> al posto di
-- kumani.io/ref/<codice>/bio. Un nome per pagina (privato e azienda ne hanno
-- uno ciascuno), unico fra tutti gli iscritti. Vuoto = resta l'indirizzo con
-- il codice, che continua sempre a funzionare (porta al nome, se c'è).
alter table public.link_in_bio add column if not exists slug text
  check (slug is null or (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$' and slug !~ '--'));
create unique index if not exists link_in_bio_slug_key on public.link_in_bio (slug) where slug is not null;
