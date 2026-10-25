-- Costi e margini: carta con cui si paga ogni costo e sua scadenza (mese),
-- per l'avviso un mese prima (Admin e notifica agli admin), e lo stato
-- «In attesa» per i servizi decisi ma non ancora attivati (non contano
-- nei totali finché non diventano attivi).

alter table public.platform_costs
  add column if not exists payment_card text check (payment_card is null or char_length(payment_card) <= 40),
  add column if not exists card_expiry date check (card_expiry is null or extract(day from card_expiry) = 1),
  add column if not exists status text not null default 'active' check (status in ('active', 'pending'));
