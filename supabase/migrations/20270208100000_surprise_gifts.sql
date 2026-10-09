-- KUMANI Sorpresa: un Kumano crea un regalo per qualcuno («Ti regalo un
-- massaggio…») e lo manda con un link (WhatsApp, email, QR).
-- - voucher: buono regalo che si apre con un'animazione (anche da una data);
-- - journey3 / journey7: percorso a sorpresa di 3 o 7 giorni, con tappe
--   (messaggi, foto, video, audio, indizi) che si svelano una al giorno e il
--   buono alla fine.
-- Si prepara e si guarda in anteprima gratis; si paga (Stripe, una tantum)
-- per attivare il link. Chi riceve non ha bisogno di un account: la pagina
-- pubblica legge dal server con la chiave segreta (nessuna regola per anon)
-- e manda solo le tappe già sbloccate.

create table if not exists public.surprise_gifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'voucher' check (kind in ('voucher', 'journey3', 'journey7')),
  status text not null default 'draft' check (status in ('draft', 'active')),
  theme text not null default 'gold' check (theme in ('gold', 'rose', 'sky', 'green', 'night')),
  recipient_name text not null default '' check (char_length(recipient_name) <= 60),
  sender_name text not null default '' check (char_length(sender_name) <= 60),
  title text not null default '' check (char_length(title) <= 80),
  message text not null default '' check (char_length(message) <= 1500),
  how_to_use text not null default '' check (char_length(how_to_use) <= 600),
  valid_until date,
  cover_path text,
  start_at timestamptz,
  locale text not null default 'it',
  public_token text unique,
  paid_at timestamptz,
  amount_cents integer,
  stripe_session_id text unique,
  stripe_payment_intent text,
  refunded_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists surprise_gifts_user_idx on public.surprise_gifts (user_id, created_at desc);
create index if not exists surprise_gifts_pi_idx on public.surprise_gifts (stripe_payment_intent);

create table if not exists public.surprise_steps (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.surprise_gifts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day smallint not null default 1 check (day between 1 and 7),
  position smallint not null default 0,
  title text not null default '' check (char_length(title) <= 80),
  message text not null default '' check (char_length(message) <= 1500),
  hint text not null default '' check (char_length(hint) <= 300),
  media_path text,
  media_type text check (media_type in ('image', 'video', 'audio')),
  created_at timestamptz not null default now()
);
create index if not exists surprise_steps_gift_idx on public.surprise_steps (gift_id, day, position);

alter table public.surprise_gifts enable row level security;
alter table public.surprise_steps enable row level security;

drop policy if exists surprise_gifts_own on public.surprise_gifts;
create policy surprise_gifts_own on public.surprise_gifts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists surprise_steps_own on public.surprise_steps;
create policy surprise_steps_own on public.surprise_steps for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.surprise_gifts g where g.id = gift_id and g.user_id = (select auth.uid())));
grant select, insert, update, delete on public.surprise_gifts, public.surprise_steps to authenticated;

-- Pagamento, stato e link li decide solo il server; il tipo non cambia dopo
-- il pagamento
create or replace function public.surprise_gifts_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.public_token := null;
    new.paid_at := null;
    new.amount_cents := null;
    new.stripe_session_id := null;
    new.stripe_payment_intent := null;
    new.refunded_at := null;
    new.opened_at := null;
  else
    new.status := old.status;
    new.public_token := old.public_token;
    new.paid_at := old.paid_at;
    new.amount_cents := old.amount_cents;
    new.stripe_session_id := old.stripe_session_id;
    new.stripe_payment_intent := old.stripe_payment_intent;
    new.refunded_at := old.refunded_at;
    new.opened_at := old.opened_at;
    new.user_id := old.user_id;
    if old.status = 'active' then
      new.kind := old.kind;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists surprise_gifts_guard on public.surprise_gifts;
create trigger surprise_gifts_guard before insert or update on public.surprise_gifts
  for each row execute function public.surprise_gifts_guard();

-- Limiti (Admin → Limiti e pulizia)
insert into public.app_limits (key, value, kind, section, label, sort) values
  ('surprise_gifts', 50, 'count', 'Sorpresa', 'Sorprese (anche bozze) per persona', 150),
  ('surprise_steps', 30, 'count', 'Sorpresa', 'Tappe per sorpresa', 151),
  ('files_surprise-media', 300, 'files', 'File per persona', 'Foto, video e audio delle sorprese', 207)
on conflict (key) do nothing;

drop trigger if exists app_limit_check on public.surprise_gifts;
create trigger app_limit_check before insert on public.surprise_gifts
  for each row execute function public.enforce_app_limit('surprise_gifts', 'user_id');
drop trigger if exists app_limit_check on public.surprise_steps;
create trigger app_limit_check before insert on public.surprise_steps
  for each row execute function public.enforce_app_limit('surprise_steps', 'gift_id');

-- Prezzi (centesimi), modificabili da Admin → Impostazioni
insert into public.system_settings (key, value) values
  ('surprise_price_voucher_cents', '290'),
  ('surprise_price_journey3_cents', '990'),
  ('surprise_price_journey7_cents', '1590')
on conflict (key) do nothing;

-- Consenso al pagamento (prova): tipo «surprise»
alter table public.subscription_consents drop constraint if exists subscription_consents_kind_check;
alter table public.subscription_consents add constraint subscription_consents_kind_check
  check (kind in ('checkout', 'upgrade', 'pass', 'gift', 'surprise'));

-- File: foto (ridotte nell'app), video e audio brevi, max 20 MB l'uno.
-- Cartella = id della persona; chi riceve li vede con link firmati dal server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('surprise-media', 'surprise-media', false, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/wav'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists surprise_media_select on storage.objects;
create policy surprise_media_select on storage.objects for select to authenticated
  using (bucket_id = 'surprise-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists surprise_media_insert on storage.objects;
create policy surprise_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'surprise-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists surprise_media_delete on storage.objects;
create policy surprise_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'surprise-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
