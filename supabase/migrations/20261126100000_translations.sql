-- Area Traduttori: account creati dall'Admin (niente profilo KUMANI, niente
-- matrice), testi corretti per lingua e storico delle modifiche.
-- Tutto si legge e si scrive SOLO dal server (chiave di servizio), dopo
-- aver verificato chi è l'utente e quali lingue può toccare: nessun
-- permesso dal browser.

-- Traduttori e lingue assegnate (l'italiano è la base: non si traduce)
create table if not exists public.translators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  locales text[] not null default '{}'
    check (locales <@ array['en', 'fr', 'es', 'pt', 'de', 'ru']::text[]),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Testi corretti dai traduttori: si sovrappongono ai file delle lingue.
-- source_hash = impronta del testo italiano al momento della correzione:
-- se l'italiano cambia, la traduzione risulta "da ricontrollare".
create table if not exists public.translation_overrides (
  locale text not null check (locale in ('en', 'fr', 'es', 'pt', 'de', 'ru')),
  key text not null check (char_length(key) between 1 and 200),
  value text not null check (char_length(value) <= 5000),
  source_hash text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (locale, key)
);

-- Storico: chi ha cambiato cosa e quando (per ripristinare)
create table if not exists public.translation_history (
  id uuid primary key default gen_random_uuid(),
  locale text not null,
  key text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists translation_history_changed_idx on public.translation_history (changed_at desc);
create index if not exists translation_history_key_idx on public.translation_history (locale, key, changed_at desc);

alter table public.translators enable row level security;
alter table public.translation_overrides enable row level security;
alter table public.translation_history enable row level security;
revoke all on public.translators from anon, authenticated;
revoke all on public.translation_overrides from anon, authenticated;
revoke all on public.translation_history from anon, authenticated;
