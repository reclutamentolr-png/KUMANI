-- KUMANI NEXUS — fase 2: il duello con un amico.
-- Due Kumani, una griglia 9×9 costruita dal server a partire dal seme della
-- sfida (le risposte non sono salvate qui né mandate al browser). A turno si
-- prova una parola: se è giusta prende il colore di chi l'ha trovata e dà
-- punti (lettere + 3 per ogni incrocio con parole già prese, doppio sulla
-- casella ×2). Le regole stanno nel server (azioni nexusDuel); qui solo i
-- dati, leggibili e scrivibili solo dal server.

create table if not exists public.nexus_duels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  locale text not null check (locale in ('it', 'en')),
  seed text not null,
  status text not null default 'waiting' check (status in ('waiting', 'live', 'finished')),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  turn_id uuid,
  turn_ends_at timestamptz,
  -- turni di fila senza parole trovate (dopo troppi la partita finisce)
  stall smallint not null default 0,
  host_score integer not null default 0,
  guest_score integer not null default 0,
  winner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_nexus_duels_host on public.nexus_duels(host_id, created_at desc);
create index if not exists idx_nexus_duels_guest on public.nexus_duels(guest_id, created_at desc);

create table if not exists public.nexus_duel_moves (
  id bigint generated always as identity primary key,
  duel_id uuid not null references public.nexus_duels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- null = tempo scaduto
  slot_id text,
  correct boolean not null default false,
  points integer not null default 0,
  crossings smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_nexus_duel_moves_duel on public.nexus_duel_moves(duel_id, id);
-- Una parola si prende una volta sola
create unique index if not exists idx_nexus_duel_claim on public.nexus_duel_moves(duel_id, slot_id) where correct;

alter table public.nexus_duels enable row level security;
alter table public.nexus_duel_moves enable row level security;

-- Segnale "c'è una novità" sul canale pubblico della sfida (nessun dato):
-- i due browser rileggono lo stato dal server.
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
