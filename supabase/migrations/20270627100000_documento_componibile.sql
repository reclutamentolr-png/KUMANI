-- DOCUMENTO COMPONIBILE: si compone un modulo a blocchi (parti fisse e parti
-- da compilare) e si scarica un PDF in cui i campi si compilano con qualsiasi
-- lettore PDF. Il PDF si fa nel browser; qui si salvano i documenti.
--
-- - Interruttore dell'Admin: spento (Solo Staff) finché lo Staff non lo
--   accende; piano Pro ('pro').
-- - I blocchi stanno in un jsonb (immagini comprese, come data URL già
--   ridotte nel browser): al massimo 150 blocchi, 6 immagini e circa 2,5 MB
--   per documento (gli stessi limiti li controlla anche il server).
-- - Al massimo 200 documenti per persona (Admin → Limiti e pulizia).

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('documento-componibile', false, true, 'pro', 'Documento componibile – moduli a blocchi (testi fissi e campi da compilare) e PDF compilabile, con modelli pronti')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('documento-componibile', 'Documento componibile', 1, 10)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Conteggi sui blocchi (per i controlli e per l'elenco dei documenti)

create or replace function public.composable_doc_image_count(b jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer
  from jsonb_array_elements(case when jsonb_typeof(b) = 'array' then b else '[]'::jsonb end) as e
  where e ->> 'type' = 'image' and coalesce(e ->> 'image', '') <> ''
$$;

create or replace function public.composable_doc_field_count(b jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer
  from jsonb_array_elements(case when jsonb_typeof(b) = 'array' then b else '[]'::jsonb end) as e
  where e ->> 'type' in ('input', 'textarea', 'date', 'checkbox', 'select')
$$;

-- ---------------------------------------------------------------------------
-- Documenti

create table if not exists public.composable_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  footer text not null default '' check (char_length(footer) <= 160),
  blocks jsonb not null default '[]'::jsonb,
  field_count integer generated always as (public.composable_doc_field_count(blocks)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint composable_documents_blocks_array check (jsonb_typeof(blocks) = 'array'),
  constraint composable_documents_blocks_count check (jsonb_array_length(blocks) <= 150),
  -- 2,5 MB nel server (testo JSON compatto) + margine per gli spazi del jsonb
  constraint composable_documents_blocks_size check (octet_length(blocks::text) <= 2600000),
  constraint composable_documents_blocks_images check (public.composable_doc_image_count(blocks) <= 6)
);
create index if not exists idx_composable_documents_user on public.composable_documents(user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Sicurezza: ognuno vede e cambia solo i suoi documenti; scrivere richiede il piano

alter table public.composable_documents enable row level security;

drop policy if exists composable_documents_own_select on public.composable_documents;
create policy composable_documents_own_select on public.composable_documents for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists composable_documents_own_insert on public.composable_documents;
create policy composable_documents_own_insert on public.composable_documents for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists composable_documents_own_update on public.composable_documents;
create policy composable_documents_own_update on public.composable_documents for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists composable_documents_own_delete on public.composable_documents;
create policy composable_documents_own_delete on public.composable_documents for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists composable_documents_plan_insert on public.composable_documents;
create policy composable_documents_plan_insert on public.composable_documents as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('documento-componibile') t where t.allowed));
drop policy if exists composable_documents_plan_update on public.composable_documents;
create policy composable_documents_plan_update on public.composable_documents as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('documento-componibile') t where t.allowed));

-- ---------------------------------------------------------------------------
-- Data dell'ultima modifica; proprietario e data di creazione non cambiano

create or replace function public.composable_documents_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists composable_documents_touch on public.composable_documents;
create trigger composable_documents_touch before insert or update on public.composable_documents
  for each row execute function public.composable_documents_touch();

-- ---------------------------------------------------------------------------
-- Limite per persona (modificabile dall'Admin → Limiti e pulizia)

insert into public.app_limits (key, value, kind, section, label, sort)
values ('composable_documents', 200, 'count', 'Documento componibile', 'Documenti per persona', 165)
on conflict (key) do nothing;

drop trigger if exists app_limit_check on public.composable_documents;
create trigger app_limit_check before insert on public.composable_documents
  for each row execute function public.enforce_app_limit('composable_documents', 'user_id');
