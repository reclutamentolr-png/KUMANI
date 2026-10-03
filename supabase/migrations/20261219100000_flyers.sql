-- Documenti → Doc KUMANI → Volantini dei servizi: quali volantini sono
-- attivi (scelti in Admin). Il volantino non è un file: si crea al momento
-- del download, con i testi ufficiali (Area Traduttori) e il QR di invito
-- di chi lo scarica.
create table if not exists public.flyer_settings (
  tool_name text primary key,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.flyer_settings enable row level security;
drop policy if exists flyer_settings_select on public.flyer_settings;
create policy flyer_settings_select on public.flyer_settings for select to authenticated using (true);
