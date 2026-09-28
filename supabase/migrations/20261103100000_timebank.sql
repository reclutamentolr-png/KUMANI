-- KUMANI Time Bank — Fase 1 (MVP): la banca del tempo della community.
-- 1 ora = 1 ora, sempre. Gratis per tutti gli iscritti verificati
-- (identità, profilo completo, maggiorenni, iscritti da 30 giorni, regole
-- accettate). Le ore non valgono denaro, non si comprano, non si convertono
-- in punti KU o sconti.
--
-- Flusso: bacheca di richieste e offerte → chi risponde propone uno scambio
-- → l'altra parte accetta → dopo il servizio entrambi confermano → le ore
-- passano da chi riceve a chi dà (storico immutabile). In caso di
-- disaccordo lo scambio va "in contestazione" e decide lo Staff.
-- Anti-abuso: credito iniziale 2 ore, saldo tra -5 e +40, al massimo 4 ore
-- al giorno per chi dà e 4 ore a settimana tra le stesse due persone
-- (niente lavoro continuativo), categorie professionali e lavori pericolosi
-- esclusi. Tutti i valori si cambiano da Admin (system_settings).

alter table public.profiles add column if not exists timebank_terms_at timestamptz;

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('timebank', true, 'free', 'KUMANI Time Bank – banca del tempo della community. Spenta: sola lettura')
on conflict (tool_name) do nothing;

insert into public.system_settings (key, value) values
  ('timebank_welcome_hours', '2'),
  ('timebank_min_balance', '-5'),
  ('timebank_max_balance', '40'),
  ('timebank_max_hours_day', '4'),
  ('timebank_max_pair_week', '4')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Tabelle (nessuna lettura o scrittura diretta: tutto passa dalle funzioni)
-- ---------------------------------------------------------------------------
create table if not exists public.timebank_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  offers text[] not null default '{}',
  seeks text[] not null default '{}',
  bio text check (bio is null or char_length(bio) <= 500),
  city text check (city is null or char_length(city) <= 80),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  in_person boolean not null default true,
  online boolean not null default true,
  languages text[] not null default '{}',
  availability text check (availability is null or char_length(availability) <= 120),
  balance numeric(6, 2) not null default 0,
  hours_given numeric(8, 2) not null default 0,
  hours_received numeric(8, 2) not null default 0,
  exchanges_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timebank_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('request', 'offer')),
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 10 and 1500),
  category text not null check (category in (
    'home_help', 'gardening', 'errands', 'transport', 'pets', 'family', 'cooking', 'tech_help', 'digital_skills',
    'translation', 'tutoring', 'languages', 'music', 'crafts', 'reading', 'company', 'events_help', 'other'
  )),
  hours numeric(4, 2) not null check (hours >= 0.5 and hours <= 8),
  mode text not null default 'in_person' check (mode in ('in_person', 'online', 'both')),
  city text check (city is null or char_length(city) <= 80),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  languages text[] not null default '{}',
  when_text text check (when_text is null or char_length(when_text) <= 120),
  status text not null default 'open' check (status in ('open', 'closed', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tb_posts_open on public.timebank_posts(status, created_at desc);
create index if not exists idx_tb_posts_user on public.timebank_posts(user_id);

create table if not exists public.timebank_exchanges (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.timebank_posts(id) on delete set null,
  giver_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  hours numeric(4, 2) not null check (hours >= 0.5 and hours <= 8),
  note text check (note is null or char_length(note) <= 500),
  scheduled_on date,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'completed', 'cancelled', 'disputed')),
  giver_confirmed_at timestamptz,
  receiver_confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_by uuid,
  dispute_by uuid,
  dispute_reason text check (dispute_reason is null or char_length(dispute_reason) <= 1000),
  staff_note text check (staff_note is null or char_length(staff_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (giver_id <> receiver_id)
);
create index if not exists idx_tb_exchanges_giver on public.timebank_exchanges(giver_id, status);
create index if not exists idx_tb_exchanges_receiver on public.timebank_exchanges(receiver_id, status);

create table if not exists public.timebank_messages (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.timebank_exchanges(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_tb_messages_exchange on public.timebank_messages(exchange_id, created_at);

-- Storico immutabile dei movimenti di ore
create table if not exists public.timebank_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exchange_id uuid references public.timebank_exchanges(id) on delete set null,
  amount numeric(6, 2) not null,
  kind text not null check (kind in ('welcome', 'exchange', 'adjustment')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_tb_ledger_user on public.timebank_ledger(user_id, created_at desc);

create table if not exists public.timebank_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  target_user uuid references auth.users(id) on delete cascade,
  post_id uuid references public.timebank_posts(id) on delete set null,
  exchange_id uuid references public.timebank_exchanges(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.timebank_profiles enable row level security;
alter table public.timebank_posts enable row level security;
alter table public.timebank_exchanges enable row level security;
alter table public.timebank_messages enable row level security;
alter table public.timebank_ledger enable row level security;
alter table public.timebank_reports enable row level security;

-- ---------------------------------------------------------------------------
-- Aiutanti
-- ---------------------------------------------------------------------------
create or replace function public.tb_num(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(public.setting_text(p_key), '')::numeric, p_default);
$$;
revoke all on function public.tb_num(text, numeric) from public, anon, authenticated;

-- Requisiti per partecipare (stessa forma della verifica di Events/Kordata,
-- così la finestra di verifica è la stessa; niente abbonamento richiesto).
create or replace function public.timebank_checks(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'subscription', true,
    'account_age', p.created_at <= now() - interval '30 days',
    'days_left', greatest(0, 30 - floor(extract(epoch from now() - p.created_at) / 86400)::int),
    'profile', p.date_of_birth is not null and p.date_of_birth <> '2000-01-01'
               and p.date_of_birth <= (current_date - interval '18 years')
               and nullif(trim(coalesce(p.city, '')), '') is not null
               and nullif(trim(coalesce(p.phone, '')), '') is not null,
    'tax_code', public.kumano_identity_ok(p_uid),
    'has_tax_code', p.tax_code is not null,
    'identity_pending', exists (select 1 from public.identity_verifications v where v.user_id = p_uid and v.status = 'pending'),
    'identity_rejected_note', (select v.review_note from public.identity_verifications v where v.user_id = p_uid order by v.created_at desc limit 1),
    'identity_last_status', (select v.status from public.identity_verifications v where v.user_id = p_uid order by v.created_at desc limit 1),
    'terms', p.timebank_terms_at is not null,
    'blocked', coalesce(p.is_blocked, false) or p.deleted_at is not null
  )
  from public.profiles p where p.id = p_uid;
$$;
revoke all on function public.timebank_checks(uuid) from public, anon, authenticated;

create or replace function public.timebank_is_verified(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((c ->> 'account_age')::boolean and (c ->> 'profile')::boolean and (c ->> 'tax_code')::boolean
                  and (c ->> 'terms')::boolean and not (c ->> 'blocked')::boolean, false)
  from (select public.timebank_checks(p_uid) as c) x;
$$;
revoke all on function public.timebank_is_verified(uuid) from public, anon, authenticated;

-- Pronto per scambiare: verificato e con il profilo della banca creato
create or replace function public.timebank_ready(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.timebank_is_verified(p_uid) and exists (select 1 from public.timebank_profiles where user_id = p_uid);
$$;
revoke all on function public.timebank_ready(uuid) from public, anon, authenticated;

create or replace function public.timebank_name(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when p.deleted_at is not null then 'Kumano'
    else trim(coalesce(p.first_name, '') || ' ' || left(coalesce(p.last_name, ''), 1) || case when coalesce(p.last_name, '') <> '' then '.' else '' end) end
  from public.profiles p where p.id = p_uid;
$$;
revoke all on function public.timebank_name(uuid) from public, anon, authenticated;

create or replace function public.timebank_clean_array(p jsonb, p_allowed text[])
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct v), '{}')
  from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) v
  where p_allowed is null or v = any(p_allowed);
$$;

create or replace function public.timebank_categories()
returns text[]
language sql
immutable
as $$
  select array['home_help', 'gardening', 'errands', 'transport', 'pets', 'family', 'cooking', 'tech_help', 'digital_skills',
    'translation', 'tutoring', 'languages', 'music', 'crafts', 'reading', 'company', 'events_help', 'other'];
$$;

-- ---------------------------------------------------------------------------
-- Stato e profilo
-- ---------------------------------------------------------------------------
create or replace function public.timebank_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.timebank_profiles%rowtype;
begin
  if v_uid is null then
    return null;
  end if;
  select * into v_profile from public.timebank_profiles where user_id = v_uid;
  return public.timebank_checks(v_uid) || jsonb_build_object(
    'verified', public.timebank_is_verified(v_uid),
    'joined', v_profile.user_id is not null,
    'profile_data', case when v_profile.user_id is not null then to_jsonb(v_profile) end,
    'limits', jsonb_build_object(
      'min_balance', public.tb_num('timebank_min_balance', -5),
      'max_balance', public.tb_num('timebank_max_balance', 40),
      'max_day', public.tb_num('timebank_max_hours_day', 4),
      'max_pair_week', public.tb_num('timebank_max_pair_week', 4),
      'welcome', public.tb_num('timebank_welcome_hours', 2)
    ),
    'online', public.tool_online('timebank')
  );
end;
$$;
revoke all on function public.timebank_status() from public, anon;
grant execute on function public.timebank_status() to authenticated;

create or replace function public.timebank_save_profile(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new boolean;
  v_welcome numeric := public.tb_num('timebank_welcome_hours', 2);
begin
  perform public.tool_require_online('timebank');
  if v_uid is null or not public.timebank_is_verified(v_uid) then
    return 'not_verified';
  end if;
  v_new := not exists (select 1 from public.timebank_profiles where user_id = v_uid);
  insert into public.timebank_profiles (user_id, offers, seeks, bio, city, country_code, in_person, online, languages, availability)
  values (
    v_uid,
    public.timebank_clean_array(p -> 'offers', public.timebank_categories()),
    public.timebank_clean_array(p -> 'seeks', public.timebank_categories()),
    nullif(left(trim(coalesce(p ->> 'bio', '')), 500), ''),
    nullif(left(trim(coalesce(p ->> 'city', '')), 80), ''),
    nullif(upper(coalesce(p ->> 'country_code', '')), ''),
    coalesce((p ->> 'in_person')::boolean, true),
    coalesce((p ->> 'online')::boolean, true),
    public.timebank_clean_array(p -> 'languages', array['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']),
    nullif(left(trim(coalesce(p ->> 'availability', '')), 120), '')
  )
  on conflict (user_id) do update set
    offers = excluded.offers, seeks = excluded.seeks, bio = excluded.bio, city = excluded.city,
    country_code = excluded.country_code, in_person = excluded.in_person, online = excluded.online,
    languages = excluded.languages, availability = excluded.availability, updated_at = now();
  -- Benvenuto: credito iniziale (una volta sola)
  if v_new and v_welcome > 0 then
    update public.timebank_profiles set balance = balance + v_welcome where user_id = v_uid;
    insert into public.timebank_ledger (user_id, amount, kind, note) values (v_uid, v_welcome, 'welcome', 'Credito di benvenuto');
  end if;
  return 'ok';
end;
$$;
revoke all on function public.timebank_save_profile(jsonb) from public, anon;
grant execute on function public.timebank_save_profile(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Bacheca
-- ---------------------------------------------------------------------------
create or replace function public.timebank_post_card(p_post public.timebank_posts)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_post.id, 'kind', p_post.kind, 'title', p_post.title, 'description', p_post.description,
    'category', p_post.category, 'hours', p_post.hours, 'mode', p_post.mode, 'city', p_post.city,
    'country_code', p_post.country_code, 'languages', to_jsonb(p_post.languages), 'when_text', p_post.when_text,
    'status', p_post.status, 'created_at', p_post.created_at,
    'author_id', p_post.user_id,
    'author_name', public.timebank_name(p_post.user_id),
    'author_exchanges', coalesce((select exchanges_count from public.timebank_profiles where user_id = p_post.user_id), 0),
    'is_mine', p_post.user_id = auth.uid()
  );
$$;
revoke all on function public.timebank_post_card(public.timebank_posts) from public, anon, authenticated;

create or replace function public.timebank_board(p_kind text, p_category text, p_mode text, p_city text, p_query text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.timebank_post_card(x) order by x.created_at desc), '[]'::jsonb)
  from (
    select tp.* from public.timebank_posts tp
    join public.profiles pr on pr.id = tp.user_id
    where auth.uid() is not null
      and tp.status = 'open'
      and not coalesce(pr.is_blocked, false) and pr.deleted_at is null
      and (coalesce(p_kind, '') = '' or tp.kind = p_kind)
      and (coalesce(p_category, '') = '' or tp.category = p_category)
      and (coalesce(p_mode, '') = '' or tp.mode = p_mode or tp.mode = 'both')
      and (coalesce(trim(p_city), '') = '' or tp.mode = 'online' or lower(tp.city) = lower(trim(p_city)))
      and (coalesce(trim(p_query), '') = '' or tp.title ilike '%' || trim(p_query) || '%' or tp.description ilike '%' || trim(p_query) || '%')
    order by tp.created_at desc
    limit 200
  ) x;
$$;
revoke all on function public.timebank_board(text, text, text, text, text) from public, anon;
grant execute on function public.timebank_board(text, text, text, text, text) to authenticated;

create or replace function public.timebank_post_save(p_post uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_hours numeric := coalesce((p ->> 'hours')::numeric, 0);
begin
  perform public.tool_require_online('timebank');
  if v_uid is null or not public.timebank_ready(v_uid) then
    return jsonb_build_object('error', 'not_verified');
  end if;
  if coalesce(p ->> 'kind', '') not in ('request', 'offer') or not (coalesce(p ->> 'category', '') = any(public.timebank_categories()))
     or coalesce(p ->> 'mode', 'in_person') not in ('in_person', 'online', 'both') then
    return jsonb_build_object('error', 'invalid');
  end if;
  if char_length(trim(coalesce(p ->> 'title', ''))) < 3 or char_length(trim(coalesce(p ->> 'description', ''))) < 10 then
    return jsonb_build_object('error', 'invalid');
  end if;
  if v_hours < 0.5 or v_hours > 8 then
    return jsonb_build_object('error', 'hours');
  end if;
  if coalesce(p ->> 'mode', 'in_person') <> 'online' and char_length(trim(coalesce(p ->> 'city', ''))) < 2 then
    return jsonb_build_object('error', 'city');
  end if;
  if p_post is null then
    if (select count(*) from public.timebank_posts where user_id = v_uid and status = 'open') >= 10 then
      return jsonb_build_object('error', 'too_many');
    end if;
    insert into public.timebank_posts (user_id, kind, title, description, category, hours, mode, city, country_code, languages, when_text)
    values (
      v_uid, p ->> 'kind', left(trim(p ->> 'title'), 100), left(trim(p ->> 'description'), 1500), p ->> 'category',
      round(v_hours * 2) / 2, coalesce(p ->> 'mode', 'in_person'),
      nullif(left(trim(coalesce(p ->> 'city', '')), 80), ''), nullif(upper(coalesce(p ->> 'country_code', '')), ''),
      public.timebank_clean_array(p -> 'languages', array['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']),
      nullif(left(trim(coalesce(p ->> 'when_text', '')), 120), '')
    ) returning id into v_id;
    return jsonb_build_object('id', v_id);
  end if;
  update public.timebank_posts set
    kind = p ->> 'kind', title = left(trim(p ->> 'title'), 100), description = left(trim(p ->> 'description'), 1500),
    category = p ->> 'category', hours = round(v_hours * 2) / 2, mode = coalesce(p ->> 'mode', 'in_person'),
    city = nullif(left(trim(coalesce(p ->> 'city', '')), 80), ''), country_code = nullif(upper(coalesce(p ->> 'country_code', '')), ''),
    languages = public.timebank_clean_array(p -> 'languages', array['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']),
    when_text = nullif(left(trim(coalesce(p ->> 'when_text', '')), 120), ''), updated_at = now()
  where id = p_post and user_id = v_uid and status = 'open';
  if not found then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  return jsonb_build_object('id', p_post);
end;
$$;
revoke all on function public.timebank_post_save(uuid, jsonb) from public, anon;
grant execute on function public.timebank_post_save(uuid, jsonb) to authenticated;

create or replace function public.timebank_post_close(p_post uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('timebank');
  update public.timebank_posts set status = 'closed', updated_at = now()
  where id = p_post and user_id = auth.uid() and status = 'open';
  return case when found then 'ok' else 'not_allowed' end;
end;
$$;
revoke all on function public.timebank_post_close(uuid) from public, anon;
grant execute on function public.timebank_post_close(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Scambi
-- ---------------------------------------------------------------------------
-- Controlli sul saldo e sui limiti anti-abuso per uno scambio da fissare
create or replace function public.timebank_check_limits(p_giver uuid, p_receiver uuid, p_hours numeric, p_day date, p_exclude uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_receiver_balance numeric;
  v_receiver_pending numeric;
  v_giver_balance numeric;
  v_day date := coalesce(p_day, (now() at time zone 'Europe/Rome')::date);
begin
  select balance into v_receiver_balance from public.timebank_profiles where user_id = p_receiver;
  select coalesce(sum(hours), 0) into v_receiver_pending from public.timebank_exchanges
  where receiver_id = p_receiver and status in ('accepted', 'disputed') and id is distinct from p_exclude;
  if coalesce(v_receiver_balance, 0) - v_receiver_pending - p_hours < public.tb_num('timebank_min_balance', -5) then
    return 'receiver_balance';
  end if;
  select balance into v_giver_balance from public.timebank_profiles where user_id = p_giver;
  if coalesce(v_giver_balance, 0) + p_hours > public.tb_num('timebank_max_balance', 40) then
    return 'giver_max';
  end if;
  if (select coalesce(sum(hours), 0) from public.timebank_exchanges
      where giver_id = p_giver and status in ('accepted', 'completed', 'disputed') and id is distinct from p_exclude
        and coalesce(scheduled_on, (created_at at time zone 'Europe/Rome')::date) = v_day) + p_hours > public.tb_num('timebank_max_hours_day', 4) then
    return 'day_limit';
  end if;
  if (select coalesce(sum(hours), 0) from public.timebank_exchanges
      where giver_id = p_giver and receiver_id = p_receiver and status in ('accepted', 'completed', 'disputed') and id is distinct from p_exclude
        and coalesce(scheduled_on, (created_at at time zone 'Europe/Rome')::date) between v_day - 6 and v_day + 6) + p_hours > public.tb_num('timebank_max_pair_week', 4) then
    return 'pair_limit';
  end if;
  return null;
end;
$$;
revoke all on function public.timebank_check_limits(uuid, uuid, numeric, date, uuid) from public, anon, authenticated;

-- Rispondere a una richiesta (io do) o a un'offerta (io ricevo)
create or replace function public.timebank_propose(p_post uuid, p_hours numeric, p_note text, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.timebank_posts%rowtype;
  v_giver uuid;
  v_receiver uuid;
  v_hours numeric := round(coalesce(p_hours, 0) * 2) / 2;
  v_problem text;
  v_id uuid;
begin
  perform public.tool_require_online('timebank');
  if v_uid is null or not public.timebank_ready(v_uid) then
    return jsonb_build_object('error', 'not_verified');
  end if;
  select * into v_post from public.timebank_posts where id = p_post and status = 'open';
  if not found then
    return jsonb_build_object('error', 'not_available');
  end if;
  if v_post.user_id = v_uid then
    return jsonb_build_object('error', 'own_post');
  end if;
  if not public.timebank_ready(v_post.user_id) then
    return jsonb_build_object('error', 'not_available');
  end if;
  if v_hours < 0.5 or v_hours > 8 then
    return jsonb_build_object('error', 'hours');
  end if;
  if p_day is not null and p_day < (now() at time zone 'Europe/Rome')::date then
    return jsonb_build_object('error', 'date');
  end if;
  if v_post.kind = 'request' then
    v_giver := v_uid; v_receiver := v_post.user_id;
  else
    v_giver := v_post.user_id; v_receiver := v_uid;
  end if;
  if exists (select 1 from public.timebank_exchanges where post_id = p_post and status in ('proposed', 'accepted')
             and v_uid in (giver_id, receiver_id)) then
    return jsonb_build_object('error', 'already');
  end if;
  v_problem := public.timebank_check_limits(v_giver, v_receiver, v_hours, p_day, null);
  if v_problem is not null then
    return jsonb_build_object('error', v_problem);
  end if;
  insert into public.timebank_exchanges (post_id, giver_id, receiver_id, proposed_by, hours, note, scheduled_on)
  values (p_post, v_giver, v_receiver, v_uid, v_hours, nullif(left(trim(coalesce(p_note, '')), 500), ''), p_day)
  returning id into v_id;
  if nullif(trim(coalesce(p_note, '')), '') is not null then
    insert into public.timebank_messages (exchange_id, sender_id, body) values (v_id, v_uid, left(trim(p_note), 1000));
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function public.timebank_propose(uuid, numeric, text, date) from public, anon;
grant execute on function public.timebank_propose(uuid, numeric, text, date) to authenticated;

-- Accettare o rifiutare una proposta (solo l'altra parte)
create or replace function public.timebank_respond(p_exchange uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ex public.timebank_exchanges%rowtype;
  v_problem text;
begin
  perform public.tool_require_online('timebank');
  select * into v_ex from public.timebank_exchanges where id = p_exchange for update;
  if not found or v_ex.status <> 'proposed' or v_uid not in (v_ex.giver_id, v_ex.receiver_id) or v_ex.proposed_by = v_uid then
    return 'not_allowed';
  end if;
  if not p_accept then
    update public.timebank_exchanges set status = 'cancelled', cancelled_by = v_uid, updated_at = now() where id = p_exchange;
    return 'ok';
  end if;
  if not public.timebank_ready(v_uid) then
    return 'not_verified';
  end if;
  v_problem := public.timebank_check_limits(v_ex.giver_id, v_ex.receiver_id, v_ex.hours, v_ex.scheduled_on, v_ex.id);
  if v_problem is not null then
    return v_problem;
  end if;
  update public.timebank_exchanges set status = 'accepted', updated_at = now() where id = p_exchange;
  return 'ok';
end;
$$;
revoke all on function public.timebank_respond(uuid, boolean) from public, anon;
grant execute on function public.timebank_respond(uuid, boolean) to authenticated;

create or replace function public.timebank_cancel(p_exchange uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('timebank');
  update public.timebank_exchanges set status = 'cancelled', cancelled_by = auth.uid(), updated_at = now()
  where id = p_exchange and auth.uid() in (giver_id, receiver_id) and status in ('proposed', 'accepted')
    and giver_confirmed_at is null and receiver_confirmed_at is null;
  return case when found then 'ok' else 'not_allowed' end;
end;
$$;
revoke all on function public.timebank_cancel(uuid) from public, anon;
grant execute on function public.timebank_cancel(uuid) to authenticated;

-- Chiude uno scambio: ore da chi riceve a chi dà, storico, contatori
create or replace function public.timebank_complete(p_exchange uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ex public.timebank_exchanges%rowtype;
begin
  select * into v_ex from public.timebank_exchanges where id = p_exchange for update;
  if v_ex.status not in ('accepted', 'disputed') then
    return;
  end if;
  update public.timebank_exchanges set status = 'completed', completed_at = now(), updated_at = now() where id = p_exchange;
  update public.timebank_profiles set balance = balance + v_ex.hours, hours_given = hours_given + v_ex.hours,
    exchanges_count = exchanges_count + 1, updated_at = now() where user_id = v_ex.giver_id;
  update public.timebank_profiles set balance = balance - v_ex.hours, hours_received = hours_received + v_ex.hours,
    exchanges_count = exchanges_count + 1, updated_at = now() where user_id = v_ex.receiver_id;
  insert into public.timebank_ledger (user_id, exchange_id, amount, kind, note) values
    (v_ex.giver_id, v_ex.id, v_ex.hours, 'exchange', 'Ore date'),
    (v_ex.receiver_id, v_ex.id, -v_ex.hours, 'exchange', 'Ore ricevute');
end;
$$;
revoke all on function public.timebank_complete(uuid) from public, anon, authenticated;

-- Conferma dopo il servizio: quando confermano entrambi, le ore passano
create or replace function public.timebank_confirm(p_exchange uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ex public.timebank_exchanges%rowtype;
begin
  perform public.tool_require_online('timebank');
  select * into v_ex from public.timebank_exchanges where id = p_exchange for update;
  if not found or v_ex.status <> 'accepted' or v_uid not in (v_ex.giver_id, v_ex.receiver_id) then
    return 'not_allowed';
  end if;
  if v_ex.scheduled_on is not null and v_ex.scheduled_on > (now() at time zone 'Europe/Rome')::date then
    return 'too_early';
  end if;
  if v_uid = v_ex.giver_id then
    update public.timebank_exchanges set giver_confirmed_at = coalesce(giver_confirmed_at, now()), updated_at = now() where id = p_exchange;
  else
    update public.timebank_exchanges set receiver_confirmed_at = coalesce(receiver_confirmed_at, now()), updated_at = now() where id = p_exchange;
  end if;
  select * into v_ex from public.timebank_exchanges where id = p_exchange;
  if v_ex.giver_confirmed_at is not null and v_ex.receiver_confirmed_at is not null then
    perform public.timebank_complete(p_exchange);
    return 'completed';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.timebank_confirm(uuid) from public, anon;
grant execute on function public.timebank_confirm(uuid) to authenticated;

-- Contestazione: lo scambio si ferma e decide lo Staff
create or replace function public.timebank_dispute(p_exchange uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('timebank');
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    return 'invalid';
  end if;
  update public.timebank_exchanges set status = 'disputed', dispute_by = auth.uid(),
    dispute_reason = left(trim(p_reason), 1000), updated_at = now()
  where id = p_exchange and auth.uid() in (giver_id, receiver_id) and status = 'accepted';
  return case when found then 'ok' else 'not_allowed' end;
end;
$$;
revoke all on function public.timebank_dispute(uuid, text) from public, anon;
grant execute on function public.timebank_dispute(uuid, text) to authenticated;

-- Decisione dello Staff su una contestazione (solo dal server)
create or replace function public.timebank_admin_resolve(p_exchange uuid, p_complete boolean, p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.timebank_exchanges where id = p_exchange and status = 'disputed') then
    return 'not_allowed';
  end if;
  update public.timebank_exchanges set staff_note = nullif(left(trim(coalesce(p_note, '')), 1000), '') where id = p_exchange;
  if p_complete then
    perform public.timebank_complete(p_exchange);
  else
    update public.timebank_exchanges set status = 'cancelled', updated_at = now() where id = p_exchange;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.timebank_admin_resolve(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.timebank_admin_resolve(uuid, boolean, text) to service_role;

-- I miei scambi, annunci e movimenti
create or replace function public.timebank_my()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'exchanges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'post_id', e.post_id, 'post_title', (select title from public.timebank_posts where id = e.post_id),
        'role', case when e.giver_id = auth.uid() then 'giver' else 'receiver' end,
        'other_name', public.timebank_name(case when e.giver_id = auth.uid() then e.receiver_id else e.giver_id end),
        'hours', e.hours, 'note', e.note, 'scheduled_on', e.scheduled_on, 'status', e.status,
        'proposed_by_me', e.proposed_by = auth.uid(),
        'my_confirmed', case when e.giver_id = auth.uid() then e.giver_confirmed_at is not null else e.receiver_confirmed_at is not null end,
        'other_confirmed', case when e.giver_id = auth.uid() then e.receiver_confirmed_at is not null else e.giver_confirmed_at is not null end,
        'dispute_reason', e.dispute_reason, 'staff_note', e.staff_note, 'created_at', e.created_at, 'completed_at', e.completed_at
      ) order by case e.status when 'proposed' then 0 when 'accepted' then 1 when 'disputed' then 2 else 3 end, e.created_at desc)
      from public.timebank_exchanges e where auth.uid() in (e.giver_id, e.receiver_id)
    ), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(public.timebank_post_card(p) order by p.created_at desc)
      from public.timebank_posts p where p.user_id = auth.uid() and p.status <> 'removed'
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(jsonb_build_object('amount', l.amount, 'kind', l.kind, 'note', l.note, 'created_at', l.created_at) order by l.created_at desc)
      from (select * from public.timebank_ledger where user_id = auth.uid() order by created_at desc limit 30) l
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.timebank_my() from public, anon;
grant execute on function public.timebank_my() to authenticated;

-- Messaggi di uno scambio (solo le due parti)
create or replace function public.timebank_messages_list(p_exchange uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.sender_id = auth.uid(), 'name', public.timebank_name(m.sender_id),
    'body', m.body, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
  from public.timebank_messages m
  join public.timebank_exchanges e on e.id = m.exchange_id
  where m.exchange_id = p_exchange and auth.uid() in (e.giver_id, e.receiver_id);
$$;
revoke all on function public.timebank_messages_list(uuid) from public, anon;
grant execute on function public.timebank_messages_list(uuid) to authenticated;

create or replace function public.timebank_send(p_exchange uuid, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tool_require_online('timebank');
  if char_length(trim(coalesce(p_body, ''))) = 0 then
    return 'invalid';
  end if;
  if not exists (select 1 from public.timebank_exchanges where id = p_exchange and auth.uid() in (giver_id, receiver_id)
                 and status in ('proposed', 'accepted', 'disputed')) then
    return 'not_allowed';
  end if;
  insert into public.timebank_messages (exchange_id, sender_id, body) values (p_exchange, auth.uid(), left(trim(p_body), 1000));
  return 'ok';
end;
$$;
revoke all on function public.timebank_send(uuid, text) from public, anon;
grant execute on function public.timebank_send(uuid, text) to authenticated;

create or replace function public.timebank_report(p_post uuid, p_exchange uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if auth.uid() is null or char_length(trim(coalesce(p_reason, ''))) < 5 then
    return 'invalid';
  end if;
  if p_post is not null then
    select user_id into v_target from public.timebank_posts where id = p_post;
  elsif p_exchange is not null then
    select case when giver_id = auth.uid() then receiver_id else giver_id end into v_target
    from public.timebank_exchanges where id = p_exchange and auth.uid() in (giver_id, receiver_id);
  end if;
  if v_target is null then
    return 'not_found';
  end if;
  insert into public.timebank_reports (reporter, target_user, post_id, exchange_id, reason)
  values (auth.uid(), v_target, p_post, p_exchange, left(trim(p_reason), 1000));
  return 'ok';
end;
$$;
revoke all on function public.timebank_report(uuid, uuid, text) from public, anon;
grant execute on function public.timebank_report(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancellazione account (GDPR): profilo e annunci della banca spariscono;
-- gli scambi restano per l'altra parte con il nome anonimo.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fidelity_members where user_id = new.id;
  delete from public.trip_exits where user_id = new.id;
  update public.veritas_players set nickname = 'Kumano' where user_id = new.id;
  delete from public.svat_qc_reports where user_id = new.id;
  delete from public.timebank_posts where user_id = new.id;
  delete from public.timebank_profiles where user_id = new.id;
  delete from public.timebank_messages where sender_id = new.id;
  return new;
end;
$$;

-- Punti KU giornalieri anche per la Time Bank (uso dello strumento, non le ore)
CREATE OR REPLACE FUNCTION public.award_tool_point(p_tool_name text)
 RETURNS TABLE(awarded boolean, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_rows int;
  v_balance int;
begin
  if auth.uid() is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank'
  ) then
    return;
  end if;

  -- Niente punti per strumenti non inclusi nel piano (evita di raccogliere
  -- KU chiamando la funzione direttamente senza usare lo strumento).
  if not exists (select 1 from public.tool_access(auth.uid(), p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (auth.uid(), p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + 1,
      ku_earned_total = coalesce(ku_earned_total, 0) + 1
  where id = auth.uid()
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;

-- Pallino oro in Admin: contestazioni e segnalazioni della Time Bank
create or replace function public.admin_section_badges()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_default timestamptz := now() - interval '7 days';
  seen jsonb;
begin
  if v_uid is null or not public.admin_is_staff(v_uid) then
    return '{}'::jsonb;
  end if;
  select coalesce(jsonb_object_agg(section, seen_at), '{}'::jsonb) into seen from public.admin_section_seen where admin_id = v_uid;
  return jsonb_strip_nulls(jsonb_build_object(
    'users', nullif((select count(*) from public.profiles where created_at > coalesce((seen ->> 'users')::timestamptz, v_default)), 0),
    'profileRequests', nullif((select count(*) from public.profile_change_requests where status = 'pending' and created_at > coalesce((seen ->> 'profileRequests')::timestamptz, v_default)), 0),
    'accountDeletions', nullif((select count(*) from public.account_deletion_requests where status = 'pending' and requested_at > coalesce((seen ->> 'accountDeletions')::timestamptz, v_default)), 0),
    'listingReports', nullif((select count(*) from public.listing_reports where created_at > coalesce((seen ->> 'listingReports')::timestamptz, v_default)), 0),
    'spotlight', nullif((select count(*) from public.spotlight_profiles where moderation_status = 'pending' and updated_at > coalesce((seen ->> 'spotlight')::timestamptz, v_default)), 0),
    'affinity', nullif((select count(*) from public.affinity_reports where status = 'open' and created_at > coalesce((seen ->> 'affinity')::timestamptz, v_default)), 0),
    'convivio', nullif((select count(*) from public.convivio_reports where status = 'open' and created_at > coalesce((seen ->> 'convivio')::timestamptz, v_default))
                     + (select count(*) from public.convivio_groups where created_at > coalesce((seen ->> 'convivio')::timestamptz, v_default)), 0),
    'events', nullif((select count(*) from public.events where status = 'pending' and updated_at > coalesce((seen ->> 'events')::timestamptz, v_default))
                   + (select count(*) from public.event_reports where status = 'open' and created_at > coalesce((seen ->> 'events')::timestamptz, v_default))
                   + (select count(*) from public.events where status = 'published' and created_at > coalesce((seen ->> 'events')::timestamptz, v_default)), 0),
    'identity', nullif((select count(*) from public.identity_verifications where status = 'pending' and created_at > coalesce((seen ->> 'identity')::timestamptz, v_default)), 0),
    'convivioFees', nullif((select count(*) from public.convivio_fees where created_at > coalesce((seen ->> 'convivioFees')::timestamptz, v_default)), 0),
    'rewards', nullif((select count(*) from public.reward_redemptions where fulfilled_at is null and redeemed_at > coalesce((seen ->> 'rewards')::timestamptz, v_default)), 0),
    'contactMessages', nullif((select count(*) from public.contact_messages where status = 'new' and created_at > coalesce((seen ->> 'contactMessages')::timestamptz, v_default)), 0),
    'timebank', nullif((select count(*) from public.timebank_exchanges where status = 'disputed' and updated_at > coalesce((seen ->> 'timebank')::timestamptz, v_default))
                     + (select count(*) from public.timebank_reports where status = 'open' and created_at > coalesce((seen ->> 'timebank')::timestamptz, v_default)), 0)
  ));
end;
$$;
