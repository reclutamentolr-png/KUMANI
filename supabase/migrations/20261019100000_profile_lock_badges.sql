-- 1. Profilo completo = dati bloccati: dopo il completamento l'utente non
--    modifica più i suoi dati; li cambia solo lo Staff su richiesta motivata.
-- 2. Promemoria "completa il profilo": dopo il primo chiuso senza completare,
--    la richiesta diventa obbligatoria.
-- 3. Pallini oro nel menu Admin: novità e code da gestire per sezione.

-- ---------------------------------------------------------------------------
-- 1. Blocco del profilo
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists profile_completed_at timestamptz;
alter table public.profiles add column if not exists profile_reminder_dismissed_at timestamptz;

create or replace function public.profile_fields_complete(p public.profiles)
returns boolean
language sql
immutable
as $$
  select nullif(trim(coalesce(p.first_name, '')), '') is not null
     and nullif(trim(coalesce(p.last_name, '')), '') is not null
     and p.date_of_birth is not null and p.date_of_birth <> date '2000-01-01'
     and nullif(trim(coalesce(p.phone, '')), '') is not null
     and nullif(trim(coalesce(p.country_code, '')), '') is not null
     and nullif(trim(coalesce(p.city, '')), '') is not null
     and nullif(trim(coalesce(p.address, '')), '') is not null
     and nullif(trim(coalesce(p.occupation, '')), '') is not null;
$$;

-- Profili già completi: bloccati da subito.
update public.profiles p set profile_completed_at = now()
where p.profile_completed_at is null and public.profile_fields_complete(p);

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_allowed text[] := array[
    'first_name', 'last_name', 'username', 'phone', 'country_code', 'date_of_birth',
    'gender', 'city', 'address', 'postal_code', 'province', 'occupation',
    'last_seen', 'qualifications_seen', 'updated_at'
  ];
  v_locked text[] := array[
    'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'country_code',
    'city', 'province', 'address', 'postal_code', 'occupation'
  ];
  v_changes jsonb;
  v_key text;
begin
  if current_user not in ('authenticated', 'anon') then
    -- Staff / funzioni del server: nessun limite, ma si registra il completamento
    if tg_op = 'UPDATE' and new.profile_completed_at is null and public.profile_fields_complete(new) then
      new.profile_completed_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.email := coalesce(auth.email(), new.email);
    new.is_admin := false;
    new.is_blocked := false;
    new.is_verified := false;
    new.is_active := true;
    new.network_points := 0;
    new.daily_points := 0;
    new.last_daily_login := null;
    new.total_listings := 0;
    new.rank_bonuses_claimed := '{}';
    new.qualifications_seen := '{}';
    new.subscription_status := 'free';
    new.subscription_expires_at := null;
    new.subscription_source := null;
    new.matrix_bonus_direct_slots_paid := 0;
    new.matrix_bonus_spillover_slots_paid := 0;
    new.sponsor_overflow_bonus_paid := 0;
    new.profile_completed_at := null;
    return new;
  end if;

  -- UPDATE: si parte dalla riga vecchia e si applicano solo le colonne ammesse.
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_changes
  from jsonb_each(to_jsonb(new))
  where key = any(v_allowed);

  -- Profilo completato: i dati anagrafici non si cambiano più da soli.
  if old.profile_completed_at is not null then
    foreach v_key in array v_locked loop
      if (v_changes -> v_key) is distinct from (to_jsonb(old) -> v_key) then
        raise exception 'profile_locked' using errcode = 'P0001';
      end if;
    end loop;
  end if;

  new := jsonb_populate_record(old, v_changes);

  -- Dati "certificati" (età per Affinity, codice fiscale): mai dall'utente.
  if old.date_of_birth is not null and old.date_of_birth <> date '2000-01-01' then
    new.date_of_birth := old.date_of_birth;
  end if;
  if old.tax_code is not null then
    new.first_name := old.first_name;
    new.last_name := old.last_name;
    new.date_of_birth := old.date_of_birth;
  end if;

  if old.profile_completed_at is null and public.profile_fields_complete(new) then
    new.profile_completed_at := now();
  end if;
  return new;
end;
$$;

-- Promemoria chiuso senza completare: la prossima volta è obbligatorio.
create or replace function public.profile_reminder_dismissed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set profile_reminder_dismissed_at = coalesce(profile_reminder_dismissed_at, now())
  where id = auth.uid() and profile_completed_at is null;
$$;
revoke all on function public.profile_reminder_dismissed() from public, anon;
grant execute on function public.profile_reminder_dismissed() to authenticated;

-- ---------------------------------------------------------------------------
-- Richieste di cambio dati anagrafici
-- ---------------------------------------------------------------------------
create table if not exists public.profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 1000),
  -- Solo i campi da cambiare: { "city": "Torino", ... }
  requested jsonb not null,
  -- Valori al momento della richiesta, per il confronto dello Staff
  previous jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  staff_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  user_seen_at timestamptz
);
create unique index if not exists profile_change_requests_one_pending on public.profile_change_requests(user_id) where status = 'pending';
create index if not exists profile_change_requests_status on public.profile_change_requests(status, created_at desc);
alter table public.profile_change_requests enable row level security;
drop policy if exists profile_change_requests_own on public.profile_change_requests;
create policy profile_change_requests_own on public.profile_change_requests for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.profile_change_requests to authenticated;

create or replace function public.profile_request_change(p_reason text, p_changes jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_allowed text[] := array['first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'country_code',
                            'city', 'province', 'address', 'postal_code', 'occupation'];
  v_clean jsonb := '{}'::jsonb;
  v_previous jsonb := '{}'::jsonb;
  v_key text;
  v_value text;
begin
  if v_uid is null then
    return 'not_allowed';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if coalesce(v_profile.is_blocked, false) then
    return 'not_allowed';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    return 'reason';
  end if;
  if exists (select 1 from public.profile_change_requests where user_id = v_uid and status = 'pending') then
    return 'pending';
  end if;
  if jsonb_typeof(p_changes) <> 'object' then
    return 'invalid';
  end if;
  for v_key, v_value in select key, value #>> '{}' from jsonb_each(p_changes) loop
    if v_key = any(v_allowed) and nullif(trim(coalesce(v_value, '')), '') is not null
       and trim(v_value) is distinct from (to_jsonb(v_profile) ->> v_key) then
      v_clean := v_clean || jsonb_build_object(v_key, left(trim(v_value), 200));
      v_previous := v_previous || jsonb_build_object(v_key, to_jsonb(v_profile) -> v_key);
    end if;
  end loop;
  if v_clean = '{}'::jsonb then
    return 'no_changes';
  end if;
  if v_clean ? 'date_of_birth' and (v_clean ->> 'date_of_birth') !~ '^\d{4}-\d{2}-\d{2}$' then
    return 'invalid';
  end if;
  insert into public.profile_change_requests (user_id, reason, requested, previous)
  values (v_uid, left(trim(p_reason), 1000), v_clean, v_previous);
  return 'ok';
end;
$$;
revoke all on function public.profile_request_change(text, jsonb) from public, anon;
grant execute on function public.profile_request_change(text, jsonb) to authenticated;

create or replace function public.profile_cancel_change_request()
returns text
language sql
security definer
set search_path = public
as $$
  update public.profile_change_requests set status = 'cancelled', reviewed_at = now(), user_seen_at = now()
  where user_id = auth.uid() and status = 'pending'
  returning 'ok';
$$;
revoke all on function public.profile_cancel_change_request() from public, anon;
grant execute on function public.profile_cancel_change_request() to authenticated;

create or replace function public.profile_change_request_seen(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profile_change_requests set user_seen_at = now()
  where id = p_id and user_id = auth.uid() and status in ('approved', 'rejected') and user_seen_at is null;
$$;
revoke all on function public.profile_change_request_seen(uuid) from public, anon;
grant execute on function public.profile_change_request_seen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pallini oro nel menu Admin
-- ---------------------------------------------------------------------------
create table if not exists public.admin_section_seen (
  admin_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (char_length(section) <= 40),
  seen_at timestamptz not null default now(),
  primary key (admin_id, section)
);
alter table public.admin_section_seen enable row level security;

create or replace function public.admin_is_staff(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_uid and is_admin)
      or exists (select 1 from public.admin_users where user_id = p_uid);
$$;
revoke all on function public.admin_is_staff(uuid) from public, anon, authenticated;

-- Per ogni sezione: code da gestire (sempre contate) + novità dall'ultima
-- visita di questo admin a quella sezione.
create or replace function public.admin_section_badges()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - interval '7 days';
  seen jsonb;
begin
  if v_uid is null or not public.admin_is_staff(v_uid) then
    return '{}'::jsonb;
  end if;
  select coalesce(jsonb_object_agg(section, seen_at), '{}'::jsonb) into seen from public.admin_section_seen where admin_id = v_uid;
  return jsonb_strip_nulls(jsonb_build_object(
    'users', nullif((select count(*) from public.profiles where created_at > coalesce((seen ->> 'users')::timestamptz, v_since)), 0),
    'profileRequests', nullif((select count(*) from public.profile_change_requests where status = 'pending'), 0),
    'listingReports', nullif((select count(*) from public.listing_reports where created_at > coalesce((seen ->> 'listingReports')::timestamptz, v_since)), 0),
    'spotlight', nullif((select count(*) from public.spotlight_profiles where moderation_status = 'pending'), 0),
    'affinity', nullif((select count(*) from public.affinity_reports where status = 'open'), 0),
    'convivio', nullif((select count(*) from public.convivio_reports where status = 'open')
                     + (select count(*) from public.convivio_groups where created_at > coalesce((seen ->> 'convivio')::timestamptz, v_since)), 0),
    'events', nullif((select count(*) from public.events where status = 'pending')
                   + (select count(*) from public.event_reports where status = 'open')
                   + (select count(*) from public.events where status = 'published' and created_at > coalesce((seen ->> 'events')::timestamptz, v_since)), 0),
    'identity', nullif((select count(*) from public.identity_verifications where status = 'pending'), 0),
    'convivioFees', nullif((select count(*) from public.convivio_fees where created_at > coalesce((seen ->> 'convivioFees')::timestamptz, v_since)), 0),
    'rewards', nullif((select count(*) from public.reward_redemptions where fulfilled_at is null), 0),
    'contactMessages', nullif((select count(*) from public.contact_messages where status = 'new'), 0)
  ));
end;
$$;
revoke all on function public.admin_section_badges() from public, anon;
grant execute on function public.admin_section_badges() to authenticated;

create or replace function public.admin_mark_section_seen(p_section text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.admin_is_staff(auth.uid()) then
    return;
  end if;
  insert into public.admin_section_seen (admin_id, section, seen_at)
  values (auth.uid(), left(p_section, 40), now())
  on conflict (admin_id, section) do update set seen_at = now();
end;
$$;
revoke all on function public.admin_mark_section_seen(text) from public, anon;
grant execute on function public.admin_mark_section_seen(text) to authenticated;
