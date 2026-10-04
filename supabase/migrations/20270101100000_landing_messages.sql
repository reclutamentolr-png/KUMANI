-- Landing Page: messaggi dei visitatori e vendita come Pass.
-- 1. Il visitatore scrive dal modulo "Scrivimi" della pagina: il messaggio
--    arriva al titolare (casella nella Landing Page, avviso in dashboard e
--    notifica sul telefono). Lo scrive solo il server; il titolare lo legge,
--    lo segna come letto o lo cancella.
-- 2. Notifiche push: nuova categoria "messaggi" (attiva di default).
-- 3. La Landing Page si può comprare anche da sola: Pass di un anno a 79 €.

-- 1. Messaggi ----------------------------------------------------------------
create table if not exists public.landing_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.landing_pages(owner_id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 80),
  sender_contact text not null check (char_length(sender_contact) between 3 and 120),
  message text not null check (char_length(message) between 1 and 2000),
  sender_hash text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists landing_messages_owner_idx on public.landing_messages (owner_id, created_at desc);
create index if not exists landing_messages_unread_idx on public.landing_messages (owner_id) where read_at is null;

alter table public.landing_messages enable row level security;
drop policy if exists landing_messages_own_select on public.landing_messages;
create policy landing_messages_own_select on public.landing_messages for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists landing_messages_own_update on public.landing_messages;
create policy landing_messages_own_update on public.landing_messages for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists landing_messages_own_delete on public.landing_messages;
create policy landing_messages_own_delete on public.landing_messages for delete to authenticated
  using (owner_id = (select auth.uid()));
revoke insert, update on public.landing_messages from authenticated, anon;
grant select, delete on public.landing_messages to authenticated;
grant update (read_at) on public.landing_messages to authenticated;

-- 2. Notifiche push: categoria "messaggi" -------------------------------------
alter table public.push_preferences add column if not exists messages boolean not null default true;

-- 3. Pass della Landing Page: 79 € per un anno ---------------------------------
update public.marketplace_settings
set pass_enabled = true, pass_price_cents = 7900
where tool_name = 'landing-page';
