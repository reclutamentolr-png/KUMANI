-- KUMANI Sorpresa: ringraziamenti letti / da leggere. Un ringraziamento
-- nuovo appare con la busta in «Le mie sorprese» e nel popup della
-- dashboard finché chi ha creato la sorpresa non lo apre o lo segna letto.
-- read_at lo scrive solo il server (dopo aver controllato che la sorpresa
-- sia di chi lo chiede).
alter table public.surprise_replies add column if not exists read_at timestamptz;
create index if not exists surprise_replies_unread_idx on public.surprise_replies (gift_id) where read_at is null;
