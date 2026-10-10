-- KUMANI NEXUS — la Sfida da 2 a 4 giocatori (prima: duello a due).
-- I giocatori stanno in una tabella a parte, con il loro posto (0-3) che
-- decide l'ordine dei turni e il colore. Chi crea la sfida avvia la partita
-- quando ci sono almeno 2 giocatori. Da applicare dopo 20270216100000.

create table if not exists public.nexus_duel_players (
  duel_id uuid not null references public.nexus_duels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  score integer not null default 0,
  -- uscito dalla partita in corso (non gioca più e non può vincere)
  left_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (duel_id, user_id),
  unique (duel_id, seat)
);
create index if not exists idx_nexus_duel_players_user on public.nexus_duel_players(user_id, joined_at desc);

alter table public.nexus_duel_players enable row level security;

-- Le sfide create col duello a due passano alla nuova tabella
insert into public.nexus_duel_players (duel_id, user_id, seat, score)
select id, host_id, 0, host_score from public.nexus_duels
on conflict do nothing;
insert into public.nexus_duel_players (duel_id, user_id, seat, score)
select id, guest_id, 1, guest_score from public.nexus_duels where guest_id is not null
on conflict do nothing;

alter table public.nexus_duels drop column if exists guest_id;
alter table public.nexus_duels drop column if exists host_score;
alter table public.nexus_duels drop column if exists guest_score;
drop index if exists public.idx_nexus_duels_guest;
