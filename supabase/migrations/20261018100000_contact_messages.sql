-- Messaggi inviati dal modulo della pagina Contatti. Li scrive solo il
-- server (client di servizio, con limite di invii); li legge lo Staff in Admin.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 5 and 200),
  topic text not null check (topic in ('support', 'billing', 'pro', 'partnership', 'privacy', 'other')),
  message text not null check (char_length(message) between 10 and 3000),
  locale text,
  status text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists idx_contact_messages_status on public.contact_messages(status, created_at desc);
create index if not exists idx_contact_messages_email on public.contact_messages(lower(email), created_at desc);
alter table public.contact_messages enable row level security;
