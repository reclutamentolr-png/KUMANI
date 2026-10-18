-- KUMANI Convivium: «il tavolo si apre con un link». Chi è iscritto crea una
-- serata (aperitivo, pizza, cena…) e la condivide con un link; chi lo riceve
-- risponde «Ci sto» / «Forse» / «Non posso» SENZA registrarsi, scrivendo solo
-- il nome. Chi organizza vede chi ha risposto. Il giorno prima parte un
-- promemoria (Centro avvisi e notifiche) a chi organizza e agli invitati iscritti.
-- Il nome «convivio» resta a Kordata (acquisti di gruppo): qui è «convivium».
-- Piano Free per tutti gli iscritti.

create table if not exists public.convivium_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  occasion text not null default 'aperitivo'
    check (occasion in ('aperitivo', 'pizza', 'cena', 'pranzo', 'colazione', 'festa', 'sport', 'altro')),
  title text not null check (char_length(title) between 1 and 80),
  note text check (note is null or char_length(note) <= 500),
  starts_at timestamptz not null,
  place text check (place is null or char_length(place) <= 120),
  maps_url text check (maps_url is null or (char_length(maps_url) <= 500 and maps_url ~* '^https://')),
  max_guests int check (max_guests is null or max_guests between 1 and 200),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  cancelled_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists convivium_events_owner on public.convivium_events(owner_id, starts_at desc);
create index if not exists convivium_events_reminder on public.convivium_events(starts_at)
  where reminder_sent_at is null and cancelled_at is null;

-- Risposte: nome scritto dall'invitato; guest_token è il segreto (cookie sul
-- suo telefono) che gli permette di cambiare risposta; user_id solo se era
-- entrato in KUMANI (per il promemoria).
create table if not exists public.convivium_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.convivium_events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  guest_token text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists convivium_rsvps_event on public.convivium_rsvps(event_id, created_at);
create unique index if not exists convivium_rsvps_user on public.convivium_rsvps(event_id, user_id) where user_id is not null;

-- Chi organizza non cambia proprietario né codice; se cambia l'orario il
-- promemoria riparte
create or replace function public.convivium_events_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.owner_id := old.owner_id;
  new.invite_code := old.invite_code;
  new.created_at := old.created_at;
  new.updated_at := now();
  if new.starts_at is distinct from old.starts_at then
    new.reminder_sent_at := null;
  elsif not (coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin')) then
    new.reminder_sent_at := old.reminder_sent_at;
  end if;
  return new;
end;
$$;
drop trigger if exists convivium_events_guard on public.convivium_events;
create trigger convivium_events_guard before update on public.convivium_events
  for each row execute function public.convivium_events_guard();

-- Solo chi organizza vede e modifica le sue serate e le risposte; la pagina
-- pubblica passa dalle funzioni qui sotto. Si crea solo con convivium_create.
alter table public.convivium_events enable row level security;
alter table public.convivium_rsvps enable row level security;
revoke all on public.convivium_events from anon, authenticated;
revoke all on public.convivium_rsvps from anon, authenticated;
grant select, update, delete on public.convivium_events to authenticated;
grant select, delete on public.convivium_rsvps to authenticated;

drop policy if exists convivium_events_owner_select on public.convivium_events;
create policy convivium_events_owner_select on public.convivium_events for select to authenticated using (owner_id = auth.uid());
drop policy if exists convivium_events_owner_update on public.convivium_events;
create policy convivium_events_owner_update on public.convivium_events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists convivium_events_owner_delete on public.convivium_events;
create policy convivium_events_owner_delete on public.convivium_events for delete to authenticated using (owner_id = auth.uid());
drop policy if exists convivium_rsvps_owner_select on public.convivium_rsvps;
create policy convivium_rsvps_owner_select on public.convivium_rsvps for select to authenticated
  using (exists (select 1 from public.convivium_events e where e.id = event_id and e.owner_id = auth.uid()));
drop policy if exists convivium_rsvps_owner_delete on public.convivium_rsvps;
create policy convivium_rsvps_owner_delete on public.convivium_rsvps for delete to authenticated
  using (exists (select 1 from public.convivium_events e where e.id = event_id and e.owner_id = auth.uid()));

-- Nuova serata (piano, interruttore Admin, massimo 20 serate in arrivo)
create or replace function public.convivium_create(
  p_occasion text, p_title text, p_note text, p_starts timestamptz, p_place text, p_maps text, p_max int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform public.tool_require_online('convivium');
  if not exists (select 1 from public.tool_access(v_uid, 'convivium') t where t.allowed) then raise exception 'not_allowed'; end if;
  if p_starts is null or p_starts < now() - interval '1 hour' then raise exception 'past'; end if;
  if (select count(*) from public.convivium_events where owner_id = v_uid and starts_at > now() and cancelled_at is null) >= 20 then
    raise exception 'limit';
  end if;
  loop
    v_code := upper(substring(md5(gen_random_uuid()::text) from 1 for 8));
    exit when not exists (select 1 from public.convivium_events where invite_code = v_code);
  end loop;
  insert into public.convivium_events (owner_id, occasion, title, note, starts_at, place, maps_url, max_guests, invite_code)
  values (v_uid, p_occasion, p_title, nullif(p_note, ''), p_starts, nullif(p_place, ''), nullif(p_maps, ''), p_max, v_code)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.convivium_create(text, text, text, timestamptz, text, text, int) from public, anon;
grant execute on function public.convivium_create(text, text, text, timestamptz, text, text, int) to authenticated;

-- Pagina pubblica dell'invito: la serata, chi la organizza (nome e codice
-- invito), chi ha detto «Ci sto» (solo il nome scritto), i conteggi e la
-- risposta di chi guarda (dal suo token o dal suo account)
create or replace function public.convivium_public(p_code text, p_token text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', e.invite_code,
    'occasion', e.occasion,
    'title', e.title,
    'note', e.note,
    'starts_at', e.starts_at,
    'place', e.place,
    'maps_url', e.maps_url,
    'max_guests', e.max_guests,
    'cancelled', e.cancelled_at is not null,
    'closed', e.starts_at < now() - interval '12 hours',
    'host_name', p.first_name,
    'host_referral', case when coalesce(p.is_admin, false) or p.guest_until is not null then null else p.referral_code end,
    'is_owner', e.owner_id = auth.uid(),
    'yes', (select count(*) from public.convivium_rsvps r where r.event_id = e.id and r.answer = 'yes'),
    'maybe', (select count(*) from public.convivium_rsvps r where r.event_id = e.id and r.answer = 'maybe'),
    'no', (select count(*) from public.convivium_rsvps r where r.event_id = e.id and r.answer = 'no'),
    'yes_names', coalesce((select jsonb_agg(r.name order by r.created_at) from (
      select name, created_at from public.convivium_rsvps where event_id = e.id and answer = 'yes' order by created_at limit 60) r), '[]'::jsonb),
    'mine', (select jsonb_build_object('name', r.name, 'answer', r.answer) from public.convivium_rsvps r
      where r.event_id = e.id and ((p_token is not null and r.guest_token = p_token) or (auth.uid() is not null and r.user_id = auth.uid()))
      order by r.updated_at desc limit 1)
  )
  from public.convivium_events e
  left join public.profiles p on p.id = e.owner_id
  where e.invite_code = upper(p_code);
$$;
revoke all on function public.convivium_public(text, text) from public;
grant execute on function public.convivium_public(text, text) to anon, authenticated;

-- Risposta all'invito, senza account. Stato: ok | full | closed | cancelled |
-- not_found | owner | limit | suspended. Con «ok» torna il token da tenere
-- nel cookie e se la risposta è nuova o diversa (per avvisare chi organizza).
create or replace function public.convivium_rsvp(p_code text, p_name text, p_answer text, p_token text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  e public.convivium_events%rowtype;
  r public.convivium_rsvps%rowtype;
  v_token text;
begin
  if p_answer not in ('yes', 'maybe', 'no') or char_length(v_name) not between 1 and 40 then raise exception 'invalid'; end if;
  select * into e from public.convivium_events where invite_code = upper(p_code) for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if not public.tool_online('convivium') then return jsonb_build_object('status', 'suspended'); end if;
  if e.cancelled_at is not null then return jsonb_build_object('status', 'cancelled'); end if;
  if e.starts_at < now() - interval '12 hours' then return jsonb_build_object('status', 'closed'); end if;
  if v_uid is not null and v_uid = e.owner_id then return jsonb_build_object('status', 'owner'); end if;

  select * into r from public.convivium_rsvps
  where event_id = e.id and ((p_token is not null and guest_token = p_token) or (v_uid is not null and user_id = v_uid))
  order by updated_at desc limit 1;

  if p_answer = 'yes' and e.max_guests is not null and (r.id is null or r.answer <> 'yes')
     and (select count(*) from public.convivium_rsvps where event_id = e.id and answer = 'yes') >= e.max_guests then
    return jsonb_build_object('status', 'full');
  end if;

  if r.id is not null then
    update public.convivium_rsvps
    set name = v_name, answer = p_answer, user_id = coalesce(user_id, v_uid), updated_at = now()
    where id = r.id;
    return jsonb_build_object('status', 'ok', 'token', r.guest_token, 'changed', r.answer is distinct from p_answer, 'event_id', e.id);
  end if;

  if (select count(*) from public.convivium_rsvps where event_id = e.id) >= 300 then
    return jsonb_build_object('status', 'limit');
  end if;
  v_token := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  insert into public.convivium_rsvps (event_id, name, answer, guest_token, user_id)
  values (e.id, v_name, p_answer, v_token, v_uid);
  return jsonb_build_object('status', 'ok', 'token', v_token, 'changed', true, 'event_id', e.id);
end;
$$;
revoke all on function public.convivium_rsvp(text, text, text, text) from public;
grant execute on function public.convivium_rsvp(text, text, text, text) to anon, authenticated;

-- Servizio nel catalogo: Free, acceso
insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('convivium', true, 'free', 'Convivium – crea una serata e invita con un link: si risponde senza registrarsi')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('convivium', 'Convivium', 1, 10)
on conflict (key) do nothing;

-- KU Karma del giorno anche per Convivium (creare una serata)
CREATE OR REPLACE FUNCTION public.award_tool_point_for(p_user uuid, p_tool_name text)
 RETURNS TABLE(awarded boolean, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_rows int;
  v_balance int;
  v_ku int;
begin
  if p_user is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail', 'oxygen',
    'documento-sicuro', 'verifica-iban', 'firma-email', 'calcolatrici', 'focus',
    'landing-page', 'garage', 'mandala', 'scudo-dati', 'casa', 'nexus', 'clienti', 'hopla', 'firma-pdf', 'convivium'
  ) then
    return;
  end if;

  if not exists (select 1 from public.tool_access(p_user, p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (p_user, p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  v_ku := public.ku_points_for(p_tool_name);
  if v_rows = 0 or v_ku = 0 then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + v_ku,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
  where id = p_user
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;
