-- KUMANI PRO «Clienti e Lavori» (fase 2): i lavori di ogni cliente (anche
-- nati da un preventivo) con stato, cantiere, date e cose da fare, e i
-- pagamenti ricevuti fuori dal sito (contanti, bonifico, POS…) registrati
-- a mano. I conti del cliente sommano preventivi accettati e lavori senza
-- preventivo, e tolgono pagamenti online e pagamenti registrati.

create table if not exists public.client_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.quote_clients(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  stage text not null default 'todo' check (stage in ('todo', 'doing', 'done', 'paid')),
  amount numeric(12, 2) check (amount is null or (amount >= 0 and amount <= 10000000)),
  address text check (char_length(address) <= 300),
  start_date date,
  due_date date,
  notes text check (char_length(notes) <= 3000),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_jobs_client_idx on public.client_jobs (client_id);
create index if not exists client_jobs_user_idx on public.client_jobs (user_id, stage);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.quote_clients(id) on delete cascade,
  job_id uuid references public.client_jobs(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0 and amount <= 10000000),
  paid_on date not null default current_date,
  method text not null default 'transfer' check (method in ('cash', 'transfer', 'card', 'other')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists client_payments_client_idx on public.client_payments (client_id, paid_on desc);
create index if not exists client_payments_job_idx on public.client_payments (job_id) where job_id is not null;

alter table public.client_jobs enable row level security;
alter table public.client_payments enable row level security;

-- Solo i propri; scrivere richiede il piano con Clienti e Lavori
drop policy if exists client_jobs_owner on public.client_jobs;
create policy client_jobs_owner on public.client_jobs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists client_jobs_plan_insert on public.client_jobs;
create policy client_jobs_plan_insert on public.client_jobs as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('clienti') t where t.allowed));
drop policy if exists client_jobs_plan_update on public.client_jobs;
create policy client_jobs_plan_update on public.client_jobs as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('clienti') t where t.allowed));

drop policy if exists client_payments_owner on public.client_payments;
create policy client_payments_owner on public.client_payments for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists client_payments_plan_insert on public.client_payments;
create policy client_payments_plan_insert on public.client_payments as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('clienti') t where t.allowed));
drop policy if exists client_payments_plan_update on public.client_payments;
create policy client_payments_plan_update on public.client_payments as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('clienti') t where t.allowed));

-- Riferimenti solo a righe proprie
drop trigger if exists client_jobs_own_client on public.client_jobs;
create trigger client_jobs_own_client before insert or update of client_id on public.client_jobs
  for each row execute function public.check_own_reference('client_id', 'quote_clients');
drop trigger if exists client_jobs_own_quote on public.client_jobs;
create trigger client_jobs_own_quote before insert or update of quote_id on public.client_jobs
  for each row execute function public.check_own_reference('quote_id', 'quotes');
drop trigger if exists client_payments_own_client on public.client_payments;
create trigger client_payments_own_client before insert or update of client_id on public.client_payments
  for each row execute function public.check_own_reference('client_id', 'quote_clients');
drop trigger if exists client_payments_own_job on public.client_payments;
create trigger client_payments_own_job before insert or update of job_id on public.client_payments
  for each row execute function public.check_own_reference('job_id', 'client_jobs');

-- Tetti per persona (modificabili dall'Admin)
insert into public.app_limits (key, value, kind, section, label, sort) values
  ('client_jobs', 2000, 'count', 'Clienti e Lavori', 'Lavori per persona', 72),
  ('client_payments', 5000, 'count', 'Clienti e Lavori', 'Pagamenti registrati per persona', 73)
on conflict (key) do nothing;
drop trigger if exists app_limit_check on public.client_jobs;
create trigger app_limit_check before insert on public.client_jobs
  for each row execute function public.enforce_app_limit('client_jobs', 'user_id');
drop trigger if exists app_limit_check on public.client_payments;
create trigger app_limit_check before insert on public.client_payments
  for each row execute function public.enforce_app_limit('client_payments', 'user_id');

-- Riepilogo dei clienti: da incassare = preventivi accettati (IVA compresa,
-- esclusi i rimborsati) + lavori senza preventivo; incassato = pagamenti
-- online dei preventivi + pagamenti registrati a mano
drop function if exists public.my_clients_overview();
create function public.my_clients_overview()
returns table (
  id uuid, name text, contact_name text, email text, phone text, city text,
  next_step text, next_step_due date, updated_at timestamptz,
  quotes_count integer, open_jobs integer, accepted_total numeric, paid_total numeric, owed numeric, last_quote_at date
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select
      client_id,
      count(*)::integer as quotes_count,
      coalesce(sum(case when (accepted_at is not null or payment_status = 'paid') and payment_status <> 'refunded' then
        round(case when vat_mode = 'plus' and coalesce(vat_rate, 0) > 0 then total * (1 + vat_rate / 100) else total end, 2)
      end), 0) as accepted_total,
      coalesce(sum(case when payment_status = 'paid' then paid_amount end), 0) as paid_online,
      max(issue_date) as last_quote_at
    from public.quotes
    where user_id = auth.uid() and client_id is not null
    group by client_id
  ),
  j as (
    select
      client_id,
      count(*) filter (where stage in ('todo', 'doing'))::integer as open_jobs,
      coalesce(sum(amount) filter (where quote_id is null), 0) as jobs_total
    from public.client_jobs
    where user_id = auth.uid()
    group by client_id
  ),
  p as (
    select client_id, coalesce(sum(amount), 0) as paid_manual
    from public.client_payments
    where user_id = auth.uid()
    group by client_id
  )
  select c.id, c.name, c.contact_name, c.email, c.phone, c.city, c.next_step, c.next_step_due, c.updated_at,
         coalesce(q.quotes_count, 0),
         coalesce(j.open_jobs, 0),
         coalesce(q.accepted_total, 0) + coalesce(j.jobs_total, 0),
         coalesce(q.paid_online, 0) + coalesce(p.paid_manual, 0),
         greatest(coalesce(q.accepted_total, 0) + coalesce(j.jobs_total, 0) - coalesce(q.paid_online, 0) - coalesce(p.paid_manual, 0), 0),
         q.last_quote_at
  from public.quote_clients c
  left join q on q.client_id = c.id
  left join j on j.client_id = c.id
  left join p on p.client_id = c.id
  where c.user_id = auth.uid()
  order by c.name;
$$;
revoke all on function public.my_clients_overview() from public, anon;
grant execute on function public.my_clients_overview() to authenticated;
