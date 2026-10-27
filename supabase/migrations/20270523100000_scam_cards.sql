-- CARTE ANTITRUFFA (piani Plus e Pro): album di 20 carte, una per truffa.
-- Passo 1: la carta si prende rispondendo giusto alle 3 domande (cornice
-- «oro»). Le altre rarità arriveranno con i passi successivi.

create table if not exists public.scam_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_no smallint not null check (card_no between 1 and 20),
  rarity text not null default 'oro' check (rarity in ('oro', 'catturata', 'rara', 'mese')),
  obtained_at timestamptz not null default now(),
  primary key (user_id, card_no)
);

alter table public.scam_cards enable row level security;

-- Ognuno vede solo le sue carte; si aggiungono solo dal server (dopo le domande)
drop policy if exists "scam_cards_select_own" on public.scam_cards;
create policy "scam_cards_select_own" on public.scam_cards for select using (auth.uid() = user_id);

-- Interruttore dell'Admin: spento (Solo Staff) finché lo Staff non lo accende
insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('carte-antitruffa', false, true, 'base', 'Carte Antitruffa – album di 20 carte, una per truffa: si prendono rispondendo a 3 domande')
on conflict (tool_name) do nothing;
