-- Biglietto da visita «classico» (dati stampati, stili, colori, logo, QR
-- facoltativo, fronte o fronte e retro) accanto a quello KUMANI con QR.
-- kind: quale dei due si sta usando; classic: le scelte del biglietto classico
-- (stile, colori, campi mostrati, testi corretti a mano…).

alter table public.business_cards add column if not exists kind text not null default 'kumani';
alter table public.business_cards add column if not exists classic jsonb;

alter table public.business_cards drop constraint if exists business_cards_kind_check;
alter table public.business_cards add constraint business_cards_kind_check check (kind in ('kumani', 'classic'));
-- Le scelte sono poche: niente oggetti enormi
alter table public.business_cards drop constraint if exists business_cards_classic_size;
alter table public.business_cards add constraint business_cards_classic_size check (classic is null or pg_column_size(classic) < 8000);
