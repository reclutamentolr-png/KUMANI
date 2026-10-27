-- CARTE ANTITRUFFA – Passo 3
-- Carta rara: a chi segnala per primo un caso nuovo alla Rete Anti-Truffa,
-- confermato dallo Staff (sulla carta il suo nome). Carta del mese: scelta
-- dallo Staff; chi la prende con le domande in quel mese ha la cornice arcobaleno.
alter table public.scam_cards add column if not exists rare_at timestamptz;

create table if not exists public.scam_card_month (
  month text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  card_no smallint not null check (card_no between 1 and 20),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.scam_card_month enable row level security;

-- La carta del mese la vedono tutti; la sceglie solo lo Staff (dal server)
drop policy if exists "scam_card_month_read" on public.scam_card_month;
create policy "scam_card_month_read" on public.scam_card_month for select using (true);
