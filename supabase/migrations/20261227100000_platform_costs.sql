-- Costi della piattaforma (Admin → Costi e margini):
-- - platform_costs: costi ricorrenti (mensili o annuali) e una tantum
--   (hosting, database, email, dominio, consulenze…);
-- - platform_expenses: spese variabili registrate a mano, con la data
--   (fattura AI del mese, pubblicità, stampa…).
-- Commissioni Stripe, provvigioni agenti, donazioni e voucher usati sono
-- calcolati in automatico dal pannello. Solo lo Staff, dal server.

create table if not exists public.platform_costs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  provider text,
  category text not null default 'altro' check (category in ('hosting', 'database', 'email', 'dominio', 'proxy', 'ai', 'software', 'consulenze', 'marketing', 'banca', 'altro')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'yearly', 'one_off')),
  start_date date not null default current_date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.platform_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 1 and 120),
  category text not null default 'altro' check (category in ('hosting', 'database', 'email', 'dominio', 'proxy', 'ai', 'software', 'consulenze', 'marketing', 'banca', 'altro')),
  amount_cents integer not null check (amount_cents > 0),
  spent_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_platform_expenses_date on public.platform_expenses(spent_on desc);

alter table public.platform_costs enable row level security;
alter table public.platform_expenses enable row level security;
revoke all on public.platform_costs, public.platform_expenses from anon, authenticated;

-- I servizi già in uso, da completare con l'importo vero (0 = da compilare)
insert into public.platform_costs (name, provider, category, frequency, notes)
select * from (values
  ('Hosting del sito', 'Vercel', 'hosting', 'monthly', 'Piano Hobby gratuito o Pro: verificare il piano attivo'),
  ('Database e accessi', 'Supabase', 'database', 'monthly', 'Piano Free o Pro: verificare il piano attivo'),
  ('Invio email', 'Resend', 'email', 'monthly', 'Gratuito fino a 3.000 email al mese'),
  ('Proxy IP fisso (Trova Lavoro)', 'Fixie', 'proxy', 'monthly', null),
  ('Dominio kumani.io', 'Registrar del dominio', 'dominio', 'yearly', 'Rinnovo annuale'),
  ('DNS e inoltro email', 'Cloudflare', 'dominio', 'monthly', 'Piano gratuito'),
  ('Commercialista', null, 'consulenze', 'yearly', null),
  ('Consulente privacy e legale', null, 'consulenze', 'one_off', null)
) as v(name, provider, category, frequency, notes)
where not exists (select 1 from public.platform_costs);
