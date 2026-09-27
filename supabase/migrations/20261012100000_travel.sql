-- KUMANI Travel — Fase 1: viaggi di gruppo con invito, itinerario giorno per
-- giorno e checklist con responsabili.
-- Creare un viaggio richiede il piano dello strumento 'travel' (Base di
-- default); chi viene invitato partecipa anche solo registrato: è il modo in
-- cui il gruppo arriva su KUMANI. Tutto è visibile solo ai membri.

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  destination text check (char_length(destination) <= 80),
  starts_on date,
  ends_on date,
  cover_emoji text not null default '✈️' check (char_length(cover_emoji) <= 8),
  invite_code text not null unique,
  members_can_edit boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
create index if not exists idx_trip_members_user on public.trip_members(user_id);

create table if not exists public.trip_activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date not null,
  time text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  title text not null check (char_length(title) between 1 and 120),
  place text check (char_length(place) <= 160),
  map_link text check (map_link is null or map_link ~* '^https?://'),
  notes text check (char_length(notes) <= 1000),
  cost_amount numeric(12, 2) check (cost_amount is null or cost_amount >= 0),
  responsible_id uuid references public.trip_members(id) on delete set null,
  position int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_trip_act_day on public.trip_activities(trip_id, day, position);

create table if not exists public.trip_checklist (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  assigned_to uuid references public.trip_members(id) on delete set null,
  done boolean not null default false,
  done_by uuid references auth.users(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_trip_checklist on public.trip_checklist(trip_id, position);

-- ---------------------------------------------------------------------------
-- Aiutanti
-- ---------------------------------------------------------------------------
create or replace function public.trip_is_member(p_trip uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trip_members where trip_id = p_trip and user_id = p_user);
$$;

create or replace function public.trip_can_edit(p_trip uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    join public.trip_members m on m.trip_id = t.id and m.user_id = p_user
    where t.id = p_trip and (t.creator_id = p_user or t.members_can_edit)
  );
$$;

-- Segnale "c'è una novità" sul canale privato del viaggio (nessun dato).
create or replace function public.trip_signal(p_trip uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(jsonb_build_object('at', now()), 'update', 'trip:' || p_trip::text, true);
exception when others then
  null;
end;
$$;
revoke all on function public.trip_signal(uuid) from public, anon, authenticated;

create or replace function public.trip_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid := case when tg_op = 'DELETE' then old.trip_id else new.trip_id end;
begin
  if tg_table_name = 'trips' then
    v_trip := case when tg_op = 'DELETE' then old.id else new.id end;
  end if;
  perform public.trip_signal(v_trip);
  return null;
end;
$$;

-- Responsabile / assegnatario devono essere membri dello stesso viaggio.
create or replace function public.trip_check_member_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref uuid := (to_jsonb(new) ->> case when tg_table_name = 'trip_activities' then 'responsible_id' else 'assigned_to' end)::uuid;
begin
  if v_ref is not null and not exists (select 1 from public.trip_members where id = v_ref and trip_id = new.trip_id) then
    raise exception 'invalid_member' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_activities_member_ref on public.trip_activities;
create trigger trip_activities_member_ref before insert or update on public.trip_activities
  for each row execute function public.trip_check_member_ref();
drop trigger if exists trip_checklist_member_ref on public.trip_checklist;
create trigger trip_checklist_member_ref before insert or update on public.trip_checklist
  for each row execute function public.trip_check_member_ref();

drop trigger if exists trips_signal on public.trips;
create trigger trips_signal after update on public.trips
  for each row execute function public.trip_touch();
drop trigger if exists trip_members_signal on public.trip_members;
create trigger trip_members_signal after insert or update or delete on public.trip_members
  for each row execute function public.trip_touch();
drop trigger if exists trip_activities_signal on public.trip_activities;
create trigger trip_activities_signal after insert or update or delete on public.trip_activities
  for each row execute function public.trip_touch();
drop trigger if exists trip_checklist_signal on public.trip_checklist;
create trigger trip_checklist_signal after insert or update or delete on public.trip_checklist
  for each row execute function public.trip_touch();

-- ---------------------------------------------------------------------------
-- Sicurezza (RLS): tutto solo ai membri
-- ---------------------------------------------------------------------------
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_activities enable row level security;
alter table public.trip_checklist enable row level security;

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated
  using (public.trip_is_member(id, (select auth.uid())));
drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update to authenticated
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));
drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips for delete to authenticated
  using (creator_id = (select auth.uid()));

drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members for select to authenticated
  using (public.trip_is_member(trip_id, (select auth.uid())));

drop policy if exists trip_activities_select on public.trip_activities;
create policy trip_activities_select on public.trip_activities for select to authenticated
  using (public.trip_is_member(trip_id, (select auth.uid())));
drop policy if exists trip_activities_insert on public.trip_activities;
create policy trip_activities_insert on public.trip_activities for insert to authenticated
  with check (public.trip_can_edit(trip_id, (select auth.uid())) and created_by = (select auth.uid()));
drop policy if exists trip_activities_update on public.trip_activities;
create policy trip_activities_update on public.trip_activities for update to authenticated
  using (public.trip_can_edit(trip_id, (select auth.uid())))
  with check (public.trip_can_edit(trip_id, (select auth.uid())));
drop policy if exists trip_activities_delete on public.trip_activities;
create policy trip_activities_delete on public.trip_activities for delete to authenticated
  using (public.trip_can_edit(trip_id, (select auth.uid())));

drop policy if exists trip_checklist_select on public.trip_checklist;
create policy trip_checklist_select on public.trip_checklist for select to authenticated
  using (public.trip_is_member(trip_id, (select auth.uid())));
drop policy if exists trip_checklist_insert on public.trip_checklist;
create policy trip_checklist_insert on public.trip_checklist for insert to authenticated
  with check (public.trip_can_edit(trip_id, (select auth.uid())));
drop policy if exists trip_checklist_update on public.trip_checklist;
-- Chi ha la voce assegnata può sempre spuntarla, anche se il creatore ha
-- chiuso le modifiche agli altri membri.
create policy trip_checklist_update on public.trip_checklist for update to authenticated
  using (
    public.trip_can_edit(trip_id, (select auth.uid()))
    or assigned_to in (select m.id from public.trip_members m where m.user_id = (select auth.uid()))
  )
  with check (
    public.trip_can_edit(trip_id, (select auth.uid()))
    or assigned_to in (select m.id from public.trip_members m where m.user_id = (select auth.uid()))
  );
drop policy if exists trip_checklist_delete on public.trip_checklist;
create policy trip_checklist_delete on public.trip_checklist for delete to authenticated
  using (public.trip_can_edit(trip_id, (select auth.uid())));

grant select, update, delete on public.trips to authenticated;
grant select on public.trip_members to authenticated;
grant select, insert, update, delete on public.trip_activities to authenticated;
grant select, insert, update, delete on public.trip_checklist to authenticated;

-- Canale in tempo reale: solo i membri del viaggio.
drop policy if exists trip_member_channel on realtime.messages;
create policy trip_member_channel on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and case
      when realtime.topic() like 'trip:%' then
        public.trip_is_member(nullif(substring(realtime.topic() from 6), '')::uuid, auth.uid())
      else false
    end
  );

-- ---------------------------------------------------------------------------
-- Funzioni
-- ---------------------------------------------------------------------------
-- Crea il viaggio: il creatore diventa "owner"; la checklist base arriva già
-- tradotta dal browser (nella lingua di chi crea).
create or replace function public.trip_create(
  p_title text,
  p_destination text,
  p_starts date,
  p_ends date,
  p_emoji text,
  p_checklist text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip uuid;
  v_code text;
  v_i int := 0;
  v_item text;
begin
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if not exists (select 1 from public.tool_access(v_uid, 'travel') t where t.allowed) then
    return jsonb_build_object('error', 'plan_required');
  end if;
  if coalesce(trim(p_title), '') = '' then
    return jsonb_build_object('error', 'invalid');
  end if;
  if p_starts is not null and p_ends is not null and p_ends < p_starts then
    return jsonb_build_object('error', 'dates');
  end if;
  if (select count(*) from public.trips where creator_id = v_uid and (ends_on is null or ends_on >= current_date)) >= 20 then
    return jsonb_build_object('error', 'too_many');
  end if;

  loop
    v_code := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
    exit when not exists (select 1 from public.trips where invite_code = v_code);
  end loop;

  insert into public.trips (creator_id, title, destination, starts_on, ends_on, cover_emoji, invite_code)
  values (v_uid, left(trim(p_title), 80), nullif(left(trim(coalesce(p_destination, '')), 80), ''), p_starts, p_ends,
          coalesce(nullif(left(trim(coalesce(p_emoji, '')), 8), ''), '✈️'), v_code)
  returning id into v_trip;

  insert into public.trip_members (trip_id, user_id, role) values (v_trip, v_uid, 'owner');

  foreach v_item in array coalesce(p_checklist, '{}') loop
    if coalesce(trim(v_item), '') <> '' and v_i < 40 then
      insert into public.trip_checklist (trip_id, title, position) values (v_trip, left(trim(v_item), 120), v_i);
      v_i := v_i + 1;
    end if;
  end loop;

  return jsonb_build_object('id', v_trip);
end;
$$;

-- Entrare con il codice invito: basta essere registrati (niente piano).
create or replace function public.trip_join(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip public.trips%rowtype;
begin
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  select * into v_trip from public.trips where invite_code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if public.trip_is_member(v_trip.id, v_uid) then
    return jsonb_build_object('id', v_trip.id);
  end if;
  if v_trip.ends_on is not null and v_trip.ends_on < current_date - 30 then
    return jsonb_build_object('error', 'ended');
  end if;
  if (select count(*) from public.trip_members where trip_id = v_trip.id) >= 20 then
    return jsonb_build_object('error', 'full');
  end if;
  insert into public.trip_members (trip_id, user_id, role) values (v_trip.id, v_uid, 'member')
  on conflict (trip_id, user_id) do nothing;
  return jsonb_build_object('id', v_trip.id);
end;
$$;

-- Anteprima pubblica del link di invito (nessun dato personale oltre al nome
-- di chi ha creato il viaggio).
create or replace function public.trip_public(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', t.invite_code,
    'title', t.title,
    'destination', t.destination,
    'starts_on', t.starts_on,
    'ends_on', t.ends_on,
    'emoji', t.cover_emoji,
    'creator_name', p.first_name,
    'creator_referral', p.referral_code,
    'members', (select count(*) from public.trip_members m where m.trip_id = t.id),
    'is_member', coalesce(public.trip_is_member(t.id, auth.uid()), false)
  )
  from public.trips t
  join public.profiles p on p.id = t.creator_id
  where t.invite_code = upper(trim(coalesce(p_code, '')));
$$;

-- Scheda del viaggio con i membri (nomi) per chi ne fa parte.
create or replace function public.trip_detail(p_trip uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'destination', t.destination,
    'starts_on', t.starts_on,
    'ends_on', t.ends_on,
    'emoji', t.cover_emoji,
    'invite_code', t.invite_code,
    'members_can_edit', t.members_can_edit,
    'is_owner', t.creator_id = auth.uid(),
    'can_edit', public.trip_can_edit(t.id, auth.uid()),
    'my_member_id', (select id from public.trip_members where trip_id = t.id and user_id = auth.uid()),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'name', coalesce(nullif(trim(p.first_name), ''), '—'),
        'role', m.role,
        'is_me', m.user_id = auth.uid()
      ) order by m.role desc, m.joined_at), '[]'::jsonb)
      from public.trip_members m join public.profiles p on p.id = m.user_id
      where m.trip_id = t.id
    )
  )
  from public.trips t
  where t.id = p_trip and public.trip_is_member(t.id, auth.uid());
$$;

-- I miei viaggi (creati o a cui partecipo), prima i prossimi.
create or replace function public.trip_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'destination', t.destination,
    'starts_on', t.starts_on,
    'ends_on', t.ends_on,
    'emoji', t.cover_emoji,
    'is_owner', t.creator_id = auth.uid(),
    'organizer_name', (select coalesce(nullif(trim(p.first_name), ''), '—') from public.profiles p where p.id = t.creator_id),
    'members', (select count(*) from public.trip_members m2 where m2.trip_id = t.id),
    'checklist_total', (select count(*) from public.trip_checklist c where c.trip_id = t.id),
    'checklist_done', (select count(*) from public.trip_checklist c where c.trip_id = t.id and c.done)
  ) order by (t.ends_on is not null and t.ends_on < current_date), t.starts_on nulls last, t.created_at desc), '[]'::jsonb)
  from public.trips t
  join public.trip_members m on m.trip_id = t.id and m.user_id = auth.uid();
$$;

-- Uscire dal viaggio (chi lo ha creato lo elimina invece di uscire) o, per
-- chi lo ha creato, togliere un membro.
create or replace function public.trip_remove_member(p_member uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.trip_members%rowtype;
  v_owner uuid;
begin
  select * into v_member from public.trip_members where id = p_member;
  if not found then
    return 'not_found';
  end if;
  select creator_id into v_owner from public.trips where id = v_member.trip_id;
  if v_member.role = 'owner' then
    return 'owner';
  end if;
  if v_member.user_id <> v_uid and v_owner is distinct from v_uid then
    return 'not_allowed';
  end if;
  delete from public.trip_members where id = p_member;
  return 'ok';
end;
$$;

revoke all on function public.trip_create(text, text, date, date, text, text[]) from public, anon;
revoke all on function public.trip_join(text) from public, anon;
revoke all on function public.trip_detail(uuid) from public, anon;
revoke all on function public.trip_list() from public, anon;
revoke all on function public.trip_remove_member(uuid) from public, anon;
grant execute on function public.trip_create(text, text, date, date, text, text[]) to authenticated;
grant execute on function public.trip_join(text) to authenticated;
grant execute on function public.trip_detail(uuid) to authenticated;
grant execute on function public.trip_list() to authenticated;
grant execute on function public.trip_remove_member(uuid) to authenticated;
grant execute on function public.trip_public(text) to anon, authenticated;

-- Strumento nel marketplace (piano deciso dall'admin; di default Base)
insert into public.marketplace_settings (tool_name, is_enabled, required_plan)
values ('travel', true, 'base')
on conflict (tool_name) do nothing;

-- Punti KU giornalieri anche per Travel
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
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel'
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
