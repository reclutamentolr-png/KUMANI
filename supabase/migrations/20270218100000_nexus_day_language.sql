-- KUMANI NEXUS — una sola lingua al giorno per il cruciverba del giorno.
-- Quando si tocca «Inizia» la lingua scelta resta quella fino a mezzanotte,
-- su tutti i dispositivi (il server non accetta parole né risultati in
-- un'altra lingua per quel giorno).

create table if not exists public.nexus_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  locale text not null check (locale in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru')),
  started_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.nexus_days enable row level security;

drop policy if exists "nexus_days_select_own" on public.nexus_days;
create policy "nexus_days_select_own" on public.nexus_days for select to authenticated using (user_id = auth.uid());

-- Chi ha già un risultato: quella è la lingua del suo giorno
insert into public.nexus_days (user_id, day, locale, started_at)
select distinct on (user_id, day) user_id, day, locale, completed_at
from public.nexus_results
order by user_id, day, completed_at
on conflict (user_id, day) do nothing;
