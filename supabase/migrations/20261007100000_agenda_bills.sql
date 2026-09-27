-- Agenda unica: le bollette vivono in Spendly (spese fisse con giorno di
-- scadenza e stato "pagata" per ogni scadenza), MemoLife resta l'agenda
-- (appuntamenti, promemoria, note, rubrica) e mostra nel suo calendario
-- anche bollette e scadenze di Life Calendar.

-- 1. Pagamenti una tantum (multa, tassa, bolletta singola)
alter table public.spendly_fixed_expenses drop constraint if exists spendly_fixed_expenses_frequency_check;
alter table public.spendly_fixed_expenses add constraint spendly_fixed_expenses_frequency_check
  check (frequency in ('mensile', 'bimestrale', 'trimestrale', 'semestrale', 'annuale', 'una_tantum'));

-- Da dove arriva la voce (es. bolletta trasferita da MemoLife): evita doppioni
-- se la migrazione viene rieseguita.
alter table public.spendly_fixed_expenses add column if not exists source_ref text;
create unique index if not exists spendly_fixed_expenses_source_ref_idx
  on public.spendly_fixed_expenses (source_ref) where source_ref is not null;

-- 2. Stato "pagata" di ogni singola scadenza, con l'importo reale (le
-- bollette cambiano: stimati 85 €, pagati 92 €). period = primo giorno del
-- mese della scadenza.
create table if not exists public.spendly_fixed_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null references public.spendly_fixed_expenses(id) on delete cascade,
  period date not null check (extract(day from period) = 1),
  amount numeric(12, 2) not null check (amount >= 0),
  paid_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (expense_id, period)
);
create index if not exists spendly_fixed_payments_user_idx on public.spendly_fixed_payments(user_id, period);

alter table public.spendly_fixed_payments enable row level security;
drop policy if exists spendly_fixed_payments_owner on public.spendly_fixed_payments;
create policy spendly_fixed_payments_owner on public.spendly_fixed_payments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.spendly_fixed_expenses e where e.id = expense_id and e.user_id = (select auth.uid()))
  );

-- 3. Le bollette di MemoLife passano in Spendly come pagamenti una tantum
-- (con lo stato "pagata" se lo erano). La tabella bills resta per sicurezza
-- ma MemoLife non la usa più.
insert into public.spendly_fixed_expenses (user_id, description, amount, frequency, category, start_date, end_date, billing_day, notes, source_ref)
select b.user_id,
       left(b.title, 200),
       coalesce(b.amount, 0),
       'una_tantum',
       'bollette',
       b.due_date,
       b.due_date,
       extract(day from b.due_date)::int,
       b.notes,
       'memolife_bill:' || b.id
from public.bills b
where b.user_id is not null
on conflict do nothing;

insert into public.spendly_fixed_payments (user_id, expense_id, period, amount, paid_on)
select e.user_id, e.id, date_trunc('month', e.start_date)::date, e.amount, e.start_date
from public.spendly_fixed_expenses e
join public.bills b on e.source_ref = 'memolife_bill:' || b.id
where b.paid
on conflict (expense_id, period) do nothing;
