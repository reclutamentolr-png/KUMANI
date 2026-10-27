-- CARTE ANTITRUFFA: chi sbaglia le domande di una carta riprova il giorno
-- dopo (giorno di Roma). Una riga per carta e giorno sbagliato.
create table if not exists public.scam_card_fails (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_no smallint not null check (card_no between 1 and 20),
  failed_on date not null,
  primary key (user_id, card_no, failed_on)
);

alter table public.scam_card_fails enable row level security;

drop policy if exists "scam_card_fails_select_own" on public.scam_card_fails;
create policy "scam_card_fails_select_own" on public.scam_card_fails for select using (auth.uid() = user_id);
