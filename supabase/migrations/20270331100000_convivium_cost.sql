-- Convivium: il costo della serata, se chi organizza lo indica, si vede già
-- sull'invito. cost_cents null = non indicato, 0 = offre chi organizza,
-- > 0 = a testa (euro). cost_note: cosa comprende (es. «aperitivo + tagliere»).
-- host_joins: chi organizza partecipa anche lui (di serie sì): è il primo
-- nome al tavolo e conta nei posti.
alter table public.convivium_events
  add column if not exists cost_cents int check (cost_cents is null or cost_cents between 0 and 100000),
  add column if not exists cost_note text check (cost_note is null or char_length(cost_note) <= 80),
  add column if not exists host_joins boolean not null default true;

drop function if exists public.convivium_create(text, text, text, timestamptz, text, text, int);
create or replace function public.convivium_create(
  p_occasion text, p_title text, p_note text, p_starts timestamptz, p_place text, p_maps text, p_max int,
  p_cost int default null, p_cost_note text default null, p_host_joins boolean default true
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
  insert into public.convivium_events (owner_id, occasion, title, note, starts_at, place, maps_url, max_guests, invite_code, cost_cents, cost_note, host_joins)
  values (v_uid, p_occasion, p_title, nullif(p_note, ''), p_starts, nullif(p_place, ''), nullif(p_maps, ''), p_max, v_code, p_cost, nullif(p_cost_note, ''), coalesce(p_host_joins, true))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.convivium_create(text, text, text, timestamptz, text, text, int, int, text, boolean) from public, anon;
grant execute on function public.convivium_create(text, text, text, timestamptz, text, text, int, int, text, boolean) to authenticated;

-- Pagina pubblica: anche il costo
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
    'cost_cents', e.cost_cents,
    'cost_note', e.cost_note,
    'host_joins', e.host_joins,
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

-- Posti al tavolo: conta anche chi organizza, se partecipa
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
     and (select count(*) from public.convivium_rsvps where event_id = e.id and answer = 'yes') + (case when e.host_joins then 1 else 0 end) >= e.max_guests then
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
