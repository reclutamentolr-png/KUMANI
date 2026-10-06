-- Ecosistema, collegamento n. 2: la «Scheda attività» unica.
--
-- I dati dell'attività (nome, logo, contatti, indirizzo, sito, social,
-- colore, orari, pagamento, link recensioni) si scrivono una volta sola e li
-- riprendono Preventivi, Landing page, Menu, Kumi Card Fidelity, Firma email,
-- QR Pro, Offermaker e gli altri servizi («Usa i dati della Scheda
-- attività»). Si parte dalla tabella dei dati emittente dei Preventivi, che
-- ha già una riga per utente e che la prova Pro riempie con partita IVA e
-- ragione sociale: qui si aggiungono i campi che mancavano.

alter table public.quote_issuer_profiles
  add column if not exists whatsapp text check (whatsapp is null or char_length(whatsapp) <= 40),
  add column if not exists website text check (website is null or char_length(website) <= 300),
  add column if not exists socials jsonb not null default '{}'::jsonb,
  add column if not exists accent text check (accent is null or accent ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists tagline text check (tagline is null or char_length(tagline) <= 160),
  add column if not exists opening_hours jsonb not null default '[]'::jsonb,
  add column if not exists payment_info text check (payment_info is null or char_length(payment_info) <= 500),
  add column if not exists review_url text check (review_url is null or char_length(review_url) <= 300);

-- La Scheda la può compilare chi ha un piano Base o Pro (prima solo chi
-- aveva i Preventivi, cioè il Pro): la usano anche servizi del Base.
drop policy if exists quote_issuer_profiles_plan_insert on public.quote_issuer_profiles;
create policy quote_issuer_profiles_plan_insert on public.quote_issuer_profiles as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed)
           or exists (select 1 from public.can_use_tool('link-in-bio') t where t.allowed));
drop policy if exists quote_issuer_profiles_plan_update on public.quote_issuer_profiles;
create policy quote_issuer_profiles_plan_update on public.quote_issuer_profiles as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed)
      or exists (select 1 from public.can_use_tool('link-in-bio') t where t.allowed));
