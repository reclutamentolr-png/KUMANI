-- LE MIE CANDIDATURE (KUMANI Lavoro, piano Plus): chi cerca lavoro segna
-- a chi ha mandato il CV, lo stato di ogni candidatura, i colloqui e quando
-- richiamare. Lo storico dei cambi di stato lo scrive il database da solo.
--
-- - Interruttore dell'Admin: spento (Solo Staff) finché lo Staff non lo
--   accende; piano Plus ('base').
-- - Ogni evento dello storico appartiene a una candidatura della stessa
--   persona: chiave esterna doppia (application_id, user_id).
-- - Al massimo 1000 candidature per persona (Admin → Limiti e pulizia).

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('candidature', false, true, 'base', 'Le mie candidature – aziende a cui hai mandato il CV, stato, colloqui, quando richiamare ed esportazione')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('candidature', 'Le mie candidature', 1, 10)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Candidature

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null check (char_length(company) between 1 and 120),
  role text check (role is null or char_length(role) <= 120),
  city text check (city is null or char_length(city) <= 80),
  source text check (source is null or source in ('online', 'word', 'in_person', 'agency', 'spontaneous', 'other')),
  ad_url text check (ad_url is null or (char_length(ad_url) <= 500 and ad_url ~* '^https?://')),
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  contact_email text check (contact_email is null or (char_length(contact_email) <= 200 and contact_email like '%_@_%')),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  sent_on date check (sent_on is null or sent_on between date '2000-01-01' and date '2100-12-31'),
  status text not null default 'sent'
    check (status in ('to_send', 'sent', 'interview_set', 'interview_done', 'offer', 'accepted', 'rejected', 'no_answer')),
  status_changed_at timestamptz not null default now(),
  interview_at timestamptz check (interview_at is null or interview_at between timestamptz '2000-01-01' and timestamptz '2100-12-31'),
  follow_up_on date check (follow_up_on is null or follow_up_on between date '2000-01-01' and date '2100-12-31'),
  notes text check (notes is null or char_length(notes) <= 3000),
  salary numeric(12, 2) check (salary is null or (salary >= 0 and salary <= 10000000)),
  salary_period text not null default 'month' check (salary_period in ('hour', 'month', 'year')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Serve alla chiave esterna doppia dello storico
  constraint job_applications_id_user_key unique (id, user_id)
);
create index if not exists idx_job_applications_user on public.job_applications(user_id, created_at desc);
create index if not exists idx_job_applications_follow_up on public.job_applications(user_id, follow_up_on) where follow_up_on is not null;

-- ---------------------------------------------------------------------------
-- Storico dei cambi di stato

create table if not exists public.job_application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null,
  from_status text check (from_status is null or from_status in ('to_send', 'sent', 'interview_set', 'interview_done', 'offer', 'accepted', 'rejected', 'no_answer')),
  to_status text not null check (to_status in ('to_send', 'sent', 'interview_set', 'interview_done', 'offer', 'accepted', 'rejected', 'no_answer')),
  created_at timestamptz not null default now(),
  -- L'evento deve appartenere a una candidatura della stessa persona
  constraint job_application_events_owner_fkey foreign key (application_id, user_id)
    references public.job_applications(id, user_id) on delete cascade
);
create index if not exists idx_job_application_events_app on public.job_application_events(application_id, created_at desc);
create index if not exists idx_job_application_events_user on public.job_application_events(user_id);

-- ---------------------------------------------------------------------------
-- Sicurezza: ognuno vede e cambia solo i suoi dati; scrivere richiede il piano

alter table public.job_applications enable row level security;
alter table public.job_application_events enable row level security;

drop policy if exists job_applications_own_select on public.job_applications;
create policy job_applications_own_select on public.job_applications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists job_applications_own_insert on public.job_applications;
create policy job_applications_own_insert on public.job_applications for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists job_applications_own_update on public.job_applications;
create policy job_applications_own_update on public.job_applications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists job_applications_own_delete on public.job_applications;
create policy job_applications_own_delete on public.job_applications for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists job_applications_plan_insert on public.job_applications;
create policy job_applications_plan_insert on public.job_applications as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('candidature') t where t.allowed));
drop policy if exists job_applications_plan_update on public.job_applications;
create policy job_applications_plan_update on public.job_applications as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('candidature') t where t.allowed));

drop policy if exists job_application_events_own_select on public.job_application_events;
create policy job_application_events_own_select on public.job_application_events for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists job_application_events_own_insert on public.job_application_events;
create policy job_application_events_own_insert on public.job_application_events for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists job_application_events_own_update on public.job_application_events;
create policy job_application_events_own_update on public.job_application_events for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists job_application_events_own_delete on public.job_application_events;
create policy job_application_events_own_delete on public.job_application_events for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists job_application_events_plan_insert on public.job_application_events;
create policy job_application_events_plan_insert on public.job_application_events as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('candidature') t where t.allowed));
drop policy if exists job_application_events_plan_update on public.job_application_events;
create policy job_application_events_plan_update on public.job_application_events as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('candidature') t where t.allowed));

-- ---------------------------------------------------------------------------
-- Data dell'ultimo cambio di stato e dell'ultima modifica

create or replace function public.job_applications_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    new.status_changed_at := old.status_changed_at;
  end if;
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists job_applications_touch on public.job_applications;
create trigger job_applications_touch before insert or update on public.job_applications
  for each row execute function public.job_applications_touch();

-- Storico: una riga a ogni nuova candidatura e a ogni cambio di stato.
-- Gira con i permessi di chi salva (le regole qui sopra valgono anche qui).
-- Per candidatura si tengono gli ultimi 100 cambi.
create or replace function public.job_applications_log_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.job_application_events (user_id, application_id, from_status, to_status)
    values (new.user_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status);

    delete from public.job_application_events e
    where e.application_id = new.id
      and e.id not in (
        select x.id from public.job_application_events x
        where x.application_id = new.id
        order by x.created_at desc
        limit 100
      );
  end if;
  return null;
end;
$$;

drop trigger if exists job_applications_log_status on public.job_applications;
create trigger job_applications_log_status after insert or update of status on public.job_applications
  for each row execute function public.job_applications_log_status();

-- ---------------------------------------------------------------------------
-- Limite per persona (modificabile dall'Admin → Limiti e pulizia)

insert into public.app_limits (key, value, kind, section, label, sort)
values ('job_applications', 1000, 'count', 'Le mie candidature', 'Candidature per persona', 150)
on conflict (key) do nothing;

drop trigger if exists app_limit_check on public.job_applications;
create trigger app_limit_check before insert on public.job_applications
  for each row execute function public.enforce_app_limit('job_applications', 'user_id');
