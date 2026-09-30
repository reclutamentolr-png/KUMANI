-- Acquisto come azienda/professionista (B2B): al checkout chi compra con
-- P.IVA dichiara di acquistare per la propria attività. Per questi acquisti
-- non si applica il diritto di recesso dei consumatori.
-- La dichiarazione si registra in subscription_consents accanto al consenso
-- all'avvio immediato dei consumatori.

alter table public.subscription_consents
  add column if not exists buyer_type text not null default 'consumer' check (buyer_type in ('consumer', 'business')),
  add column if not exists business_name text check (char_length(business_name) <= 200),
  add column if not exists vat_number text check (char_length(vat_number) <= 20);
