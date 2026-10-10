-- KUMANI NEXUS — la Sfida da 2 a 4 giocatori, aperta anche a chi non è
-- iscritto. Sostituisce le tabelle del duello a due (20270216100000), che
-- non contenevano partite vere: si ricreano da capo.
--
-- Chi crea la sfida è un Kumano; gli altri entrano dal link, iscritti o
-- ospiti con un nome. Ogni ospite ha un codice segreto (solo nel suo browser;
-- qui l'impronta sha256) che il server controlla a ogni mossa. Le regole
-- stanno nel server (azioni nexusDuel); le tabelle sono leggibili e
-- scrivibili solo dal server.

drop table if exists public.nexus_duel_moves;
drop table if exists public.nexus_duel_players;
drop table if exists public.nexus_duels;

create table public.nexus_duels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  locale text not null check (locale in ('it', 'en')),
  seed text not null,
  status text not null default 'waiting' check (status in ('waiting', 'live', 'finished')),
  host_id uuid not null references auth.users(id) on delete cascade,
  -- giocatore di turno (nexus_duel_players.id)
  turn_player uuid,
  turn_ends_at timestamptz,
  -- turni di fila senza parole trovate (dopo troppi la partita finisce)
  stall smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_nexus_duels_host on public.nexus_duels(host_id, created_at desc);

create table public.nexus_duel_players (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.nexus_duels(id) on delete cascade,
  -- iscritto (oppure null = ospite con codice segreto)
  user_id uuid references auth.users(id) on delete set null,
  token_hash text,
  nickname text not null check (char_length(nickname) between 1 and 24),
  seat smallint not null check (seat between 0 and 3),
  score integer not null default 0,
  -- uscito dalla partita in corso (non gioca più e non può vincere)
  left_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (duel_id, seat),
  check (user_id is not null or token_hash is not null)
);
create unique index idx_nexus_duel_players_user on public.nexus_duel_players(duel_id, user_id) where user_id is not null;
create index idx_nexus_duel_players_token on public.nexus_duel_players(duel_id, token_hash) where token_hash is not null;

create table public.nexus_duel_moves (
  id bigint generated always as identity primary key,
  duel_id uuid not null references public.nexus_duels(id) on delete cascade,
  player_id uuid not null references public.nexus_duel_players(id) on delete cascade,
  -- null = tempo scaduto
  slot_id text,
  correct boolean not null default false,
  points integer not null default 0,
  crossings smallint not null default 0,
  created_at timestamptz not null default now()
);
create index idx_nexus_duel_moves_duel on public.nexus_duel_moves(duel_id, id);
-- Una parola si prende una volta sola
create unique index idx_nexus_duel_claim on public.nexus_duel_moves(duel_id, slot_id) where correct;

alter table public.nexus_duels enable row level security;
alter table public.nexus_duel_players enable row level security;
alter table public.nexus_duel_moves enable row level security;

-- Segnale "c'è una novità" sul canale pubblico della sfida (nessun dato)
create or replace function public.nexus_duel_signal(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(jsonb_build_object('at', now()), 'update', 'nexus:' || p_duel::text, false);
exception when others then
  null;
end;
$$;
revoke all on function public.nexus_duel_signal(uuid) from public, anon, authenticated;
grant execute on function public.nexus_duel_signal(uuid) to service_role;
