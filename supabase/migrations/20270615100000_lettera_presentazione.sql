-- LETTERA DI PRESENTAZIONE (KUMANI Lavoro, piano Plus): una lettera per
-- ogni candidatura, con lo stesso aspetto del KUMANI CV (stessi modelli),
-- mittente preso dal CV, frasi pronte nella lingua della lettera e PDF fatto
-- nel browser.
--
-- - Interruttore dell'Admin: spento (Solo Staff) finché lo Staff non lo
--   accende; piano Plus ('base').
-- - Al massimo 200 lettere per persona (Admin → Limiti e pulizia).

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('lettera-presentazione', false, true, 'base', 'Lettera di presentazione – una lettera per ogni candidatura, stesso aspetto del CV, frasi pronte in 7 lingue e PDF')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('lettera-presentazione', 'Lettera di presentazione', 1, 10)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Lettere

create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  content_language text not null default 'it' check (content_language in ('it', 'en', 'es', 'fr', 'de', 'pt', 'ru')),
  template text not null default 'moderno'
    check (template in ('moderno', 'professionale', 'elegante', 'europeo', 'minimal', 'classic', 'sidebar')),
  position text not null default '' check (char_length(position) <= 160),
  -- Mittente
  sender_name text not null default '' check (char_length(sender_name) <= 120),
  sender_role text not null default '' check (char_length(sender_role) <= 160),
  sender_email text not null default '' check (char_length(sender_email) <= 200),
  sender_phone text not null default '' check (char_length(sender_phone) <= 40),
  sender_city text not null default '' check (char_length(sender_city) <= 120),
  -- Destinatario
  recipient_company text not null default '' check (char_length(recipient_company) <= 160),
  recipient_name text not null default '' check (char_length(recipient_name) <= 160),
  recipient_address text not null default '' check (char_length(recipient_address) <= 300),
  -- Lettera
  place text not null default '' check (char_length(place) <= 120),
  letter_date date check (letter_date is null or letter_date between date '2000-01-01' and date '2100-12-31'),
  subject text not null default '' check (char_length(subject) <= 200),
  greeting text not null default '' check (char_length(greeting) <= 160),
  body text not null default '' check (char_length(body) <= 6000),
  closing text not null default '' check (char_length(closing) <= 160),
  signature text not null default '' check (char_length(signature) <= 120),
  attach_cv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cover_letters_user on public.cover_letters(user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Sicurezza: ognuno vede e cambia solo le sue lettere; scrivere richiede il piano

alter table public.cover_letters enable row level security;

drop policy if exists cover_letters_own_select on public.cover_letters;
create policy cover_letters_own_select on public.cover_letters for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists cover_letters_own_insert on public.cover_letters;
create policy cover_letters_own_insert on public.cover_letters for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists cover_letters_own_update on public.cover_letters;
create policy cover_letters_own_update on public.cover_letters for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists cover_letters_own_delete on public.cover_letters;
create policy cover_letters_own_delete on public.cover_letters for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists cover_letters_plan_insert on public.cover_letters;
create policy cover_letters_plan_insert on public.cover_letters as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('lettera-presentazione') t where t.allowed));
drop policy if exists cover_letters_plan_update on public.cover_letters;
create policy cover_letters_plan_update on public.cover_letters as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('lettera-presentazione') t where t.allowed));

-- ---------------------------------------------------------------------------
-- Data dell'ultima modifica; proprietario e data di creazione non cambiano

create or replace function public.cover_letters_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists cover_letters_touch on public.cover_letters;
create trigger cover_letters_touch before insert or update on public.cover_letters
  for each row execute function public.cover_letters_touch();

-- ---------------------------------------------------------------------------
-- Limite per persona (modificabile dall'Admin → Limiti e pulizia)

insert into public.app_limits (key, value, kind, section, label, sort)
values ('cover_letters', 200, 'count', 'Lettera di presentazione', 'Lettere per persona', 160)
on conflict (key) do nothing;

drop trigger if exists app_limit_check on public.cover_letters;
create trigger app_limit_check before insert on public.cover_letters
  for each row execute function public.enforce_app_limit('cover_letters', 'user_id');
