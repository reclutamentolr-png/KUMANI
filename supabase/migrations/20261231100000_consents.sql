-- Consensi e rinnovi (Codice del Consumo, GDPR, AGCM):
-- 1. Iscrizione: accettazione di Termini e Privacy (obbligatoria) e
--    consenso marketing (facoltativo, revocabile dal profilo), registrati
--    con data, ora e versione.
-- 2. Pagamenti: consensi anche per i Pass (pagamento unico) e accettazione
--    dei Termini nel modulo di pagamento.
-- 3. Promemoria del rinnovo automatico: un'email per periodo.

-- 1. Consensi dell'utente ----------------------------------------------------
create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('terms', 'marketing')),
  granted boolean not null,
  version text,
  source text not null check (source in ('registration', 'profile')),
  created_at timestamptz not null default now()
);
create index if not exists user_consents_user_idx on public.user_consents (user_id, kind, created_at desc);
alter table public.user_consents enable row level security;
drop policy if exists user_consents_own_select on public.user_consents;
create policy user_consents_own_select on public.user_consents for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_consents from authenticated, anon;

alter table public.profiles add column if not exists marketing_consent boolean not null default false;
alter table public.profiles add column if not exists marketing_consent_at timestamptz;

-- Dopo la verifica dell'email: copia i consensi dati nel modulo di
-- iscrizione (salvati nei dati dell'account) nello storico. Idempotente.
create or replace function public.record_registration_consents()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_meta jsonb;
  v_marketing boolean;
begin
  if v_uid is null then
    return;
  end if;
  select raw_user_meta_data into v_meta from auth.users where id = v_uid;
  if coalesce(v_meta->>'terms_accepted_at', '') <> ''
     and not exists (select 1 from public.user_consents where user_id = v_uid and kind = 'terms' and source = 'registration') then
    insert into public.user_consents (user_id, kind, granted, version, source, created_at)
    values (v_uid, 'terms', true, v_meta->>'terms_version', 'registration',
            coalesce(nullif(v_meta->>'terms_accepted_at', '')::timestamptz, now()));
  end if;
  v_marketing := coalesce((v_meta->>'marketing_consent')::boolean, false);
  if not exists (select 1 from public.user_consents where user_id = v_uid and kind = 'marketing') then
    insert into public.user_consents (user_id, kind, granted, version, source)
    values (v_uid, 'marketing', v_marketing, v_meta->>'terms_version', 'registration');
    update public.profiles set marketing_consent = v_marketing, marketing_consent_at = now() where id = v_uid;
  end if;
end;
$$;
revoke all on function public.record_registration_consents() from public, anon;
grant execute on function public.record_registration_consents() to authenticated;

-- Consenso marketing dal profilo (si dà e si revoca con un clic)
create or replace function public.set_my_marketing_consent(p_granted boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  update public.profiles set marketing_consent = coalesce(p_granted, false), marketing_consent_at = now() where id = auth.uid();
  insert into public.user_consents (user_id, kind, granted, source) values (auth.uid(), 'marketing', coalesce(p_granted, false), 'profile');
  return coalesce(p_granted, false);
end;
$$;
revoke all on function public.set_my_marketing_consent(boolean) from public, anon;
grant execute on function public.set_my_marketing_consent(boolean) to authenticated;

create or replace function public.get_my_marketing_consent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select marketing_consent from public.profiles where id = auth.uid();
$$;
revoke all on function public.get_my_marketing_consent() from public, anon;
grant execute on function public.get_my_marketing_consent() to authenticated;

-- 2. Consensi dei pagamenti: anche i Pass, e Termini accettati -------------
alter table public.subscription_consents drop constraint if exists subscription_consents_kind_check;
alter table public.subscription_consents add constraint subscription_consents_kind_check check (kind in ('checkout', 'upgrade', 'pass'));
alter table public.subscription_consents drop constraint if exists subscription_consents_plan_check;
alter table public.subscription_consents alter column plan drop not null;
alter table public.subscription_consents add constraint subscription_consents_plan_check check (plan is null or plan in ('base', 'pro'));
alter table public.subscription_consents add column if not exists tool text;
alter table public.subscription_consents add column if not exists terms_accepted boolean not null default false;

-- 3. Promemoria del rinnovo: una sola email per abbonamento e periodo -----
create table if not exists public.renewal_reminders (
  subscription_id text not null,
  period_end timestamptz not null,
  user_id uuid references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (subscription_id, period_end)
);
alter table public.renewal_reminders enable row level security;
-- Nessuna policy: solo il server
