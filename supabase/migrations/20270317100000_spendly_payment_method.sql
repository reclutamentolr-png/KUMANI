-- Spendly: metodo di pagamento delle spese fisse e delle bollette (carta,
-- bonifico, contanti, altro). Sulla spesa è il metodo abituale; su ogni
-- pagamento registrato resta quello usato quella volta (copiato dalla spesa
-- quando si segna «Pagata»). Vuoto = non indicato (spese già inserite).

alter table public.spendly_fixed_expenses
  add column if not exists payment_method text
  check (payment_method in ('carta', 'bonifico', 'contanti', 'altro'));

alter table public.spendly_fixed_payments
  add column if not exists payment_method text
  check (payment_method in ('carta', 'bonifico', 'contanti', 'altro'));
