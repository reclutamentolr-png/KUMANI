-- CARTE ANTITRUFFA – Passo 2: la carta «catturata» quando un controllo di
-- KUMANI (SVAT, QR, CheckMail, Rete Anti-Truffa) ferma una truffa vera.
-- Da quale controllo e quando (una carta si cattura una volta sola).
alter table public.scam_cards add column if not exists captured_from text check (captured_from is null or captured_from in ('svat', 'qr', 'checkmail', 'community'));
alter table public.scam_cards add column if not exists captured_at timestamptz;
