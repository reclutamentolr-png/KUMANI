-- KUMANI PRO «Clienti e Lavori» (fase 5): dal pagamento registrato si fa la
-- ricevuta digitale; il pagamento ricorda la sua ricevuta.
alter table public.client_payments add column if not exists receipt_id uuid references public.digital_receipts(id) on delete set null;
drop trigger if exists client_payments_own_receipt on public.client_payments;
create trigger client_payments_own_receipt before insert or update of receipt_id on public.client_payments
  for each row execute function public.check_own_reference('receipt_id', 'digital_receipts');
