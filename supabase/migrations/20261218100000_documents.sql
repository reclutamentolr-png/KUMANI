-- Documenti → Doc KUMANI: materiale ufficiale (presentazione, regolamenti,
-- guide) caricato dallo Staff, in più lingue e formati, scaricabile solo
-- dagli iscritti. I file stanno nel bucket privato "kumani-docs" e si
-- scaricano con un link firmato a breve scadenza creato dal server.
create table if not exists public.kumani_documents (
  id uuid primary key default gen_random_uuid(),
  title jsonb not null default '{}'::jsonb,        -- { "it": "...", "en": "...", ... }
  description jsonb not null default '{}'::jsonb,
  category text not null default 'other' check (category in ('presentation', 'rules', 'guide', 'other')),
  sort_order int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kumani_document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kumani_documents (id) on delete cascade,
  locale text not null check (locale in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru')),
  format text not null check (format in ('pdf', 'pptx')),
  storage_path text not null,
  file_name text not null,
  size_bytes bigint not null default 0,
  uploaded_at timestamptz not null default now(),
  unique (document_id, locale, format)
);
create index if not exists kumani_document_files_doc_idx on public.kumani_document_files (document_id);

alter table public.kumani_documents enable row level security;
alter table public.kumani_document_files enable row level security;

-- Gli iscritti vedono i documenti pubblicati e i loro file; scrive solo il server
drop policy if exists kumani_documents_select on public.kumani_documents;
create policy kumani_documents_select on public.kumani_documents for select to authenticated using (is_published);
drop policy if exists kumani_document_files_select on public.kumani_document_files;
create policy kumani_document_files_select on public.kumani_document_files for select to authenticated
  using (exists (select 1 from public.kumani_documents d where d.id = document_id and d.is_published));

-- Bucket privato: nessuna policy per gli utenti, accesso solo con link firmati
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kumani-docs', 'kumani-docs', false, 52428800,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
