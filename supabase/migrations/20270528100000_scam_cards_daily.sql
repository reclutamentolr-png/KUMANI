-- CARTE ANTITRUFFA: una carta al giorno (giorno di Roma), in qualunque modo
-- arrivi: con le domande o catturata da un controllo (anche il passaggio di
-- cornice). La chiave (persona, giorno) fa da blocco: la seconda carta dello
-- stesso giorno non entra. Le carte rare (decise dallo Staff) non contano.
create table if not exists public.scam_card_gains (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  card_no smallint not null check (card_no between 1 and 20),
  source text not null check (source in ('quiz', 'svat', 'qr', 'checkmail', 'community')),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.scam_card_gains enable row level security;

drop policy if exists "scam_card_gains_select_own" on public.scam_card_gains;
create policy "scam_card_gains_select_own" on public.scam_card_gains for select using (auth.uid() = user_id);
