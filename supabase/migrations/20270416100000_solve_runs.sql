-- KUMANI Risolvi: il percorso di ogni persona in ogni guida (risposte,
-- passi spuntati, esito). Una riga per persona e guida; ognuno legge e
-- scrive solo la propria. Le guide stanno nel codice (src/lib/solve).

create table if not exists public.solve_runs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  guide_id text not null check (char_length(guide_id) between 1 and 60),
  version text not null default '1',
  answers jsonb not null default '{}'::jsonb,
  done text[] not null default '{}',
  outcome text check (outcome in ('yes', 'no', 'unknown')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, guide_id)
);

alter table public.solve_runs enable row level security;

drop policy if exists solve_runs_own on public.solve_runs;
create policy solve_runs_own on public.solve_runs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.solve_runs from anon;
grant select, insert, update, delete on public.solve_runs to authenticated;

-- Interruttore: finché è spento le guide le vede solo lo Staff (anteprima)
insert into public.system_settings (key, value, updated_at)
values ('solve_enabled', 'false', now())
on conflict (key) do nothing;
