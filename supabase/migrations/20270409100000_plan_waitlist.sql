-- «Piani in arrivo» (Admin → Apertura piani): prima dell'apertura dei piani a
-- pagamento chi tocca «Abbonati» può chiedere «Avvisami». Il giorno
-- dell'apertura riceve notifica ed email nella sua lingua (cron plans-open).
-- Si scrive solo dal server (service role); ognuno vede solo la sua riga.

create table if not exists public.plan_waitlist (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'base' check (plan in ('base', 'pro')),
  locale text not null default 'it' check (locale ~ '^[a-z]{2}$'),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create index if not exists plan_waitlist_pending_idx on public.plan_waitlist (created_at) where notified_at is null;

alter table public.plan_waitlist enable row level security;

drop policy if exists plan_waitlist_own_select on public.plan_waitlist;
create policy plan_waitlist_own_select on public.plan_waitlist
  for select to authenticated
  using (user_id = (select auth.uid()));
