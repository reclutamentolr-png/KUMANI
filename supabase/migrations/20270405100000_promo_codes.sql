-- Admin → «Codici omaggio»: codici di abbonamento (Base o Pro, un anno)
-- regalati dallo Staff per promuovere KUMANI (es. al lancio). Sono normali
-- voucher KVA- (si attivano con «Hai un codice?» o /register?voucher=CODICE,
-- una sola volta, con redeem_subscription_voucher), con in più il nome di chi
-- li ha ricevuti e una campagna facoltativa, così si vede a chi era stato dato
-- un codice e se e quando è stato attivato. Solo chiave di servizio (Admin).

alter table public.subscription_vouchers drop constraint if exists subscription_vouchers_purpose_check;
alter table public.subscription_vouchers
  add constraint subscription_vouchers_purpose_check check (purpose in ('gift', 'sale', 'promo'));

alter table public.subscription_vouchers
  add column if not exists recipient_name text check (char_length(recipient_name) <= 120),
  add column if not exists campaign text check (char_length(campaign) <= 60);

create index if not exists subscription_vouchers_promo_idx
  on public.subscription_vouchers (created_at desc) where purpose = 'promo';
