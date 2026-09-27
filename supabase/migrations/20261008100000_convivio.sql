-- Convivio (categoria Community) — Fase 1: acquisti di gruppo "su
-- prenotazione". Un capocordata verificato propone un acquisto con soglia e
-- scadenza, gli altri Kumani aderiscono; raggiunta la soglia ognuno paga
-- DIRETTAMENTE il fornitore. KUMANI non gestisce denaro in questa fase.
-- Tutto passa da funzioni SECURITY DEFINER: le tabelle non si leggono né si
-- scrivono direttamente dal browser.

-- ---------------------------------------------------------------------------
-- Capocordata verificato: codice fiscale (verificato dal server, mai visibile
-- agli altri utenti) e accettazione delle regole.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists tax_code text check (tax_code is null or tax_code ~ '^[A-Z0-9]{16}$'),
  add column if not exists convivio_terms_at timestamptz;
-- Un codice fiscale = un solo account (contro gli account multipli).
create unique index if not exists profiles_tax_code_unique on public.profiles (tax_code) where tax_code is not null;
-- Nessun grant di lettura su tax_code agli utenti: lo legge solo il
-- proprietario tramite get_my_profile() e lo Staff dal server.

create or replace function public.convivio_leader_checks(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'account_age', p.created_at <= now() - interval '30 days',
    'subscription', p.subscription_status = 'active' and (p.subscription_expires_at is null or p.subscription_expires_at > now()),
    'profile', p.date_of_birth is not null and p.date_of_birth <> '2000-01-01'
               and nullif(trim(coalesce(p.city, '')), '') is not null
               and nullif(trim(coalesce(p.phone, '')), '') is not null,
    'tax_code', p.tax_code is not null,
    'terms', p.convivio_terms_at is not null,
    'blocked', coalesce(p.is_blocked, false),
    'days_left', greatest(0, 30 - extract(day from now() - p.created_at)::int)
  )
  from public.profiles p where p.id = p_uid;
$$;
revoke all on function public.convivio_leader_checks(uuid) from public, anon, authenticated;

create or replace function public.convivio_is_verified(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((c ->> 'account_age')::boolean and (c ->> 'subscription')::boolean and (c ->> 'profile')::boolean
    and (c ->> 'tax_code')::boolean and (c ->> 'terms')::boolean and not (c ->> 'blocked')::boolean, false)
  from (select public.convivio_leader_checks(p_uid) as c) x;
$$;
revoke all on function public.convivio_is_verified(uuid) from public, anon, authenticated;

create or replace function public.convivio_my_leader_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.convivio_leader_checks(auth.uid()) || jsonb_build_object('verified', public.convivio_is_verified(auth.uid()));
$$;
revoke all on function public.convivio_my_leader_status() from public, anon;
grant execute on function public.convivio_my_leader_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table if not exists public.convivio_groups (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'food' check (category in ('food', 'tech', 'travel', 'energy', 'other')),
  supplier_name text not null check (char_length(supplier_name) between 2 and 120),
  unit_label text not null default '' check (char_length(unit_label) <= 40),
  retail_price numeric(10, 2) check (retail_price is null or retail_price >= 0),
  group_price numeric(10, 2) not null check (group_price >= 0),
  min_participants integer not null check (min_participants between 2 and 500),
  max_participants integer check (max_participants is null or max_participants >= min_participants),
  expires_at timestamptz not null,
  pickup_info text not null default '' check (char_length(pickup_info) <= 1000),
  city text check (city is null or char_length(city) <= 80),
  status text not null default 'open' check (status in ('open', 'ordered', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists convivio_groups_status_idx on public.convivio_groups(status, expires_at);
create index if not exists convivio_groups_leader_idx on public.convivio_groups(leader_id);

create table if not exists public.convivio_pledges (
  group_id uuid not null references public.convivio_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 50),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists convivio_pledges_user_idx on public.convivio_pledges(user_id);

create table if not exists public.convivio_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.convivio_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists convivio_messages_group_idx on public.convivio_messages(group_id, created_at);

create table if not exists public.convivio_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.convivio_groups(id) on delete cascade,
  reporter uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.convivio_groups enable row level security;
alter table public.convivio_pledges enable row level security;
alter table public.convivio_messages enable row level security;
alter table public.convivio_reports enable row level security;

-- ---------------------------------------------------------------------------
-- Utilità
-- ---------------------------------------------------------------------------
create or replace function public.convivio_people(p_group uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.convivio_pledges where group_id = p_group;
$$;
revoke all on function public.convivio_people(uuid) from public, anon, authenticated;

-- Stato effettivo: open | reached | failed | ordered | completed | cancelled
create or replace function public.convivio_status(p_group uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when g.status <> 'open' then g.status
    when now() > g.expires_at then case when public.convivio_people(g.id) >= g.min_participants then 'reached' else 'failed' end
    else 'open'
  end
  from public.convivio_groups g where g.id = p_group;
$$;
revoke all on function public.convivio_status(uuid) from public, anon, authenticated;

create or replace function public.convivio_is_member(p_group uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.convivio_groups where id = p_group and leader_id = p_uid)
      or exists (select 1 from public.convivio_pledges where group_id = p_group and user_id = p_uid);
$$;
revoke all on function public.convivio_is_member(uuid, uuid) from public, anon, authenticated;

create or replace function public.convivio_card(p_group uuid, p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', g.id,
    'title', g.title,
    'category', g.category,
    'city', g.city,
    'supplier_name', g.supplier_name,
    'unit_label', g.unit_label,
    'retail_price', g.retail_price,
    'group_price', g.group_price,
    'min_participants', g.min_participants,
    'max_participants', g.max_participants,
    'expires_at', g.expires_at,
    'status', public.convivio_status(g.id),
    'people', public.convivio_people(g.id),
    'quantity', (select coalesce(sum(quantity), 0) from public.convivio_pledges where group_id = g.id),
    'leader_name', p.first_name,
    'is_leader', g.leader_id = p_uid,
    'my_quantity', (select quantity from public.convivio_pledges where group_id = g.id and user_id = p_uid)
  )
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  where g.id = p_group;
$$;
revoke all on function public.convivio_card(uuid, uuid) from public, anon, authenticated;

-- Segnale "c'è una novità" sul canale privato del gruppo (nessun dato).
create or replace function public.convivio_signal(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(jsonb_build_object('at', now()), 'update', 'convivio:' || p_group::text, true);
exception when others then
  null;
end;
$$;
revoke all on function public.convivio_signal(uuid) from public, anon, authenticated;

-- Canale in tempo reale: solo capocordata e partecipanti.
drop policy if exists convivio_member_channel on realtime.messages;
create policy convivio_member_channel on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and case
      when realtime.topic() like 'convivio:%' then
        public.convivio_is_member(nullif(substring(realtime.topic() from 10), '')::uuid, auth.uid())
      else false
    end
  );

-- ---------------------------------------------------------------------------
-- Lettura
-- ---------------------------------------------------------------------------
-- 'open': cordate aperte (visibili a tutti gli iscritti); 'mine': quelle
-- proposte o a cui partecipo, in qualsiasi stato.
create or replace function public.convivio_list(p_filter text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.convivio_card(g.id, auth.uid()) order by g.expires_at), '[]'::jsonb)
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  where auth.uid() is not null
    and not coalesce(p.is_blocked, false)
    and case
      when p_filter = 'mine' then public.convivio_is_member(g.id, auth.uid())
      else g.status = 'open' and g.expires_at > now()
    end;
$$;
revoke all on function public.convivio_list(text) from public, anon;
grant execute on function public.convivio_list(text) to authenticated;

create or replace function public.convivio_detail(p_group uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.convivio_card(g.id, auth.uid()) || jsonb_build_object(
    'description', g.description,
    'pickup_info', g.pickup_info,
    'created_at', g.created_at,
    'leader_since', p.created_at,
    'is_member', public.convivio_is_member(g.id, auth.uid()),
    'my_note', (select note from public.convivio_pledges where group_id = g.id and user_id = auth.uid()),
    -- Chi partecipa (nome e quantità) solo per chi fa parte del gruppo
    'participants', case when public.convivio_is_member(g.id, auth.uid()) then (
      select coalesce(jsonb_agg(jsonb_build_object('name', pp.first_name, 'quantity', cp.quantity, 'note', case when g.leader_id = auth.uid() then cp.note end) order by cp.created_at), '[]'::jsonb)
      from public.convivio_pledges cp join public.profiles pp on pp.id = cp.user_id
      where cp.group_id = g.id
    ) else '[]'::jsonb end
  )
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  where g.id = p_group and auth.uid() is not null;
$$;
revoke all on function public.convivio_detail(uuid) from public, anon;
grant execute on function public.convivio_detail(uuid) to authenticated;

-- Anteprima pubblica (link condiviso): niente nomi dei partecipanti.
create or replace function public.convivio_public(p_group uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.convivio_card(g.id, null) || jsonb_build_object('description', g.description, 'leader_referral', p.referral_code)
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  where g.id = p_group and not coalesce(p.is_blocked, false);
$$;
revoke all on function public.convivio_public(uuid) from public;
grant execute on function public.convivio_public(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scrittura
-- ---------------------------------------------------------------------------
create or replace function public.convivio_create(
  p_title text, p_description text, p_category text, p_supplier text, p_unit text,
  p_retail numeric, p_price numeric, p_min int, p_max int, p_expires timestamptz, p_pickup text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or not public.convivio_is_verified(v_uid) then
    return jsonb_build_object('error', 'not_verified');
  end if;
  if (select count(*) from public.convivio_groups where leader_id = v_uid and status in ('open', 'ordered')) >= 3 then
    return jsonb_build_object('error', 'too_many');
  end if;
  if p_expires < now() + interval '1 day' or p_expires > now() + interval '60 days' then
    return jsonb_build_object('error', 'bad_deadline');
  end if;
  if coalesce(p_price, -1) < 0 or coalesce(p_min, 0) < 2 or (p_max is not null and p_max < p_min) then
    return jsonb_build_object('error', 'invalid');
  end if;
  insert into public.convivio_groups (leader_id, title, description, category, supplier_name, unit_label, retail_price, group_price, min_participants, max_participants, expires_at, pickup_info, city)
  values (
    v_uid, left(trim(p_title), 100), left(trim(coalesce(p_description, '')), 2000),
    case when p_category in ('food', 'tech', 'travel', 'energy', 'other') then p_category else 'other' end,
    left(trim(p_supplier), 120), left(trim(coalesce(p_unit, '')), 40),
    p_retail, p_price, least(p_min, 500), p_max, p_expires, left(trim(coalesce(p_pickup, '')), 1000),
    (select city from public.profiles where id = v_uid)
  )
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function public.convivio_create(text, text, text, text, text, numeric, numeric, int, int, timestamptz, text) from public, anon;
grant execute on function public.convivio_create(text, text, text, text, text, numeric, numeric, int, int, timestamptz, text) to authenticated;

-- Il capocordata aggiorna descrizione e istruzioni (non prezzo né soglia).
create or replace function public.convivio_update_info(p_group uuid, p_description text, p_pickup text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.convivio_groups
  set description = left(trim(coalesce(p_description, '')), 2000), pickup_info = left(trim(coalesce(p_pickup, '')), 1000), updated_at = now()
  where id = p_group and leader_id = auth.uid() and status in ('open', 'ordered');
  if not found then
    return 'not_allowed';
  end if;
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;
revoke all on function public.convivio_update_info(uuid, text, text) from public, anon;
grant execute on function public.convivio_update_info(uuid, text, text) to authenticated;

create or replace function public.convivio_join(p_group uuid, p_quantity int, p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.convivio_groups%rowtype;
  v_member boolean;
begin
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return 'not_allowed';
  end if;
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found or public.convivio_status(p_group) <> 'open' then
    return 'closed';
  end if;
  v_member := exists (select 1 from public.convivio_pledges where group_id = p_group and user_id = v_uid);
  if not v_member and v_group.max_participants is not null and public.convivio_people(p_group) >= v_group.max_participants then
    return 'full';
  end if;
  insert into public.convivio_pledges (group_id, user_id, quantity, note)
  values (p_group, v_uid, least(greatest(coalesce(p_quantity, 1), 1), 50), nullif(left(trim(coalesce(p_note, '')), 200), ''))
  on conflict (group_id, user_id) do update set quantity = excluded.quantity, note = excluded.note, updated_at = now();
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;
revoke all on function public.convivio_join(uuid, int, text) from public, anon;
grant execute on function public.convivio_join(uuid, int, text) to authenticated;

-- Ritirarsi è possibile solo finché la cordata è aperta.
create or replace function public.convivio_leave(p_group uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.convivio_status(p_group) <> 'open' then
    return 'closed';
  end if;
  delete from public.convivio_pledges where group_id = p_group and user_id = auth.uid();
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;
revoke all on function public.convivio_leave(uuid) from public, anon;
grant execute on function public.convivio_leave(uuid) to authenticated;

-- Capocordata: 'ordered' (soglia raggiunta, ordine inviato al fornitore),
-- 'completed' (consegnato), 'cancelled' (annullato).
create or replace function public.convivio_set_status(p_group uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.convivio_groups%rowtype;
  v_status text;
begin
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found or v_group.leader_id <> auth.uid() then
    return 'not_allowed';
  end if;
  v_status := public.convivio_status(p_group);
  if p_status = 'ordered' and not (v_status in ('open', 'reached') and public.convivio_people(p_group) >= v_group.min_participants) then
    return 'not_reached';
  elsif p_status = 'completed' and v_status <> 'ordered' then
    return 'not_ordered';
  elsif p_status = 'cancelled' and v_status in ('completed', 'cancelled') then
    return 'not_allowed';
  elsif p_status not in ('ordered', 'completed', 'cancelled') then
    return 'not_allowed';
  end if;
  update public.convivio_groups set status = p_status, updated_at = now() where id = p_group;
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;
revoke all on function public.convivio_set_status(uuid, text) from public, anon;
grant execute on function public.convivio_set_status(uuid, text) to authenticated;

create or replace function public.convivio_messages_list(p_group uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.convivio_is_member(p_group, auth.uid()) then coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'name', p.first_name, 'mine', m.sender_id = auth.uid(), 'is_leader', m.sender_id = g.leader_id, 'body', m.body, 'created_at', m.created_at) order by m.created_at)
    from (select * from public.convivio_messages where group_id = p_group order by created_at desc limit 200) m
    join public.profiles p on p.id = m.sender_id
    join public.convivio_groups g on g.id = m.group_id
  ), '[]'::jsonb) end;
$$;
revoke all on function public.convivio_messages_list(uuid) from public, anon;
grant execute on function public.convivio_messages_list(uuid) to authenticated;

create or replace function public.convivio_send(p_group uuid, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.convivio_is_member(p_group, auth.uid()) then
    return 'not_member';
  end if;
  if nullif(trim(coalesce(p_body, '')), '') is null then
    return 'empty';
  end if;
  if (select count(*) from public.convivio_messages where sender_id = auth.uid() and created_at > now() - interval '1 day') >= 100 then
    return 'rate_limited';
  end if;
  insert into public.convivio_messages (group_id, sender_id, body) values (p_group, auth.uid(), left(trim(p_body), 1000));
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;
revoke all on function public.convivio_send(uuid, text) from public, anon;
grant execute on function public.convivio_send(uuid, text) to authenticated;

create or replace function public.convivio_report(p_group uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or nullif(trim(coalesce(p_reason, '')), '') is null then
    return false;
  end if;
  insert into public.convivio_reports (group_id, reporter, reason) values (p_group, auth.uid(), left(trim(p_reason), 500));
  return true;
end;
$$;
revoke all on function public.convivio_report(uuid, text) from public, anon;
grant execute on function public.convivio_report(uuid, text) to authenticated;
