-- Notifiche push (Web Push): i dispositivi su cui il Kumano le ha attivate,
-- le sue preferenze, gli avvisi inviati dallo Staff e il registro delle
-- notifiche automatiche (per non mandarne due uguali).
-- Tutto passa dal server (service role): nessun accesso diretto dal browser.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  locale text not null default 'it',
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

-- Quali notifiche ricevere (senza riga = tutte attive)
create table if not exists public.push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  network boolean not null default true,
  expiry boolean not null default true,
  events boolean not null default true,
  staff boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Avvisi scritti dallo Staff (Admin → Comunicazioni → Notifiche push)
create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 240),
  url text,
  audience text not null check (audience in ('all', 'active', 'inactive')),
  locale text,
  recipients integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Notifiche automatiche già inviate (scadenze, eventi, punti)
create table if not exists public.push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_preferences enable row level security;
alter table public.push_campaigns enable row level security;
alter table public.push_log enable row level security;

revoke all on public.push_subscriptions, public.push_preferences, public.push_campaigns, public.push_log from anon, authenticated;
