-- «Proposte della community» (fase 1: proposte per KUMANI).
-- Gli iscritti propongono servizi nuovi o miglioramenti; lo Staff controlla
-- ogni proposta prima di pubblicarla; tutti gli iscritti la sostengono (in
-- modo anonimo: si vede solo il numero); lo Staff risponde in pubblico e
-- aggiorna lo stato. Chi propone un'idea realizzata riceve KU Karma.
-- Proporre: piano Base o Pro, una proposta a settimana (limite modificabile).
-- La colonna area è già pronta per la fase 2 («Nel tuo quartiere»).

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('proposte', true, 'free', 'Proposte della community – idee per KUMANI sostenute dagli iscritti')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('proposal_done', 'Proposta della community realizzata', 20, 90)
on conflict (key) do nothing;

insert into public.app_limits (key, value, kind, section, label, sort) values
  ('proposals_per_week', 1, 'count', 'Proposte della community', 'Proposte a settimana per persona', 80),
  ('proposals_pending', 3, 'count', 'Proposte della community', 'Proposte in attesa di controllo per persona', 81)
on conflict (key) do nothing;

create table if not exists public.community_proposals (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  area text not null default 'kumani' check (area in ('kumani', 'local')),
  topic text not null default 'new' check (topic in ('existing', 'new', 'app')),
  tool_name text check (char_length(tool_name) <= 60),
  title text not null check (char_length(title) between 8 and 90),
  body text not null check (char_length(body) between 20 and 1200),
  status text not null default 'pending' check (status in ('pending', 'changes', 'rejected', 'open', 'review', 'planned', 'done', 'declined')),
  staff_reply text check (char_length(staff_reply) <= 1000),
  staff_note text check (char_length(staff_note) <= 300),
  votes_count integer not null default 0,
  reports_count integer not null default 0,
  rewarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  status_changed_at timestamptz not null default now()
);
create index if not exists community_proposals_feed_idx on public.community_proposals (status, votes_count desc, published_at desc);
create index if not exists community_proposals_author_idx on public.community_proposals (author_id, created_at desc);
create index if not exists community_proposals_title_trgm on public.community_proposals using gin (title extensions.gin_trgm_ops);

create table if not exists public.community_proposal_votes (
  proposal_id uuid not null references public.community_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);
create index if not exists community_proposal_votes_user_idx on public.community_proposal_votes (user_id);

create table if not exists public.community_proposal_reports (
  proposal_id uuid not null references public.community_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('politics', 'against', 'ads', 'offensive', 'duplicate', 'other')),
  note text check (char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

alter table public.community_proposals enable row level security;
alter table public.community_proposal_votes enable row level security;
alter table public.community_proposal_reports enable row level security;

-- Si leggono le proposte pubblicate, le proprie e (Staff) tutte; si scrive solo con le funzioni qui sotto
drop policy if exists community_proposals_read on public.community_proposals;
create policy community_proposals_read on public.community_proposals for select to authenticated
  using (status in ('open', 'review', 'planned', 'done', 'declined') or author_id = auth.uid() or public.admin_is_staff(auth.uid()));
-- I sostegni sono anonimi: ognuno vede solo i propri
drop policy if exists community_proposal_votes_own on public.community_proposal_votes;
create policy community_proposal_votes_own on public.community_proposal_votes for select to authenticated
  using (user_id = auth.uid());
drop policy if exists community_proposal_reports_staff on public.community_proposal_reports;
create policy community_proposal_reports_staff on public.community_proposal_reports for select to authenticated
  using (public.admin_is_staff(auth.uid()));

-- Contatori sempre giusti
create or replace function public.community_proposal_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.proposal_id, old.proposal_id);
begin
  if tg_table_name = 'community_proposal_votes' then
    update public.community_proposals set votes_count = (select count(*) from public.community_proposal_votes where proposal_id = v_id) where id = v_id;
  else
    update public.community_proposals set reports_count = (select count(*) from public.community_proposal_reports where proposal_id = v_id and status = 'open') where id = v_id;
  end if;
  return null;
end;
$$;
revoke all on function public.community_proposal_counts() from public, anon, authenticated;
drop trigger if exists community_proposal_votes_count on public.community_proposal_votes;
create trigger community_proposal_votes_count after insert or delete on public.community_proposal_votes
  for each row execute function public.community_proposal_counts();
drop trigger if exists community_proposal_reports_count on public.community_proposal_reports;
create trigger community_proposal_reports_count after insert or delete or update of status on public.community_proposal_reports
  for each row execute function public.community_proposal_counts();

-- Nome mostrato: nome e iniziale del cognome
create or replace function public.proposal_author_name(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(left(last_name, 1) || '.', '')), '') from public.profiles where id = p_uid;
$$;
revoke all on function public.proposal_author_name(uuid) from public, anon, authenticated;

-- Elenco: pubblicate (o le proprie), con il mio sostegno e il nome dell'autore
create or replace function public.proposals_feed(p_sort text default 'top', p_mine boolean default false, p_limit integer default 100)
returns table (
  id uuid, title text, body text, topic text, tool_name text, status text, votes_count integer,
  staff_reply text, staff_note text, created_at timestamptz, published_at timestamptz, status_changed_at timestamptz,
  author_name text, is_mine boolean, my_vote boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.body, p.topic, p.tool_name, p.status, p.votes_count,
         p.staff_reply, case when p.author_id = auth.uid() then p.staff_note end, p.created_at, p.published_at, p.status_changed_at,
         public.proposal_author_name(p.author_id), p.author_id = auth.uid(),
         exists (select 1 from public.community_proposal_votes v where v.proposal_id = p.id and v.user_id = auth.uid())
  from public.community_proposals p
  where auth.uid() is not null and p.area = 'kumani'
    and (case when p_mine then p.author_id = auth.uid()
              when p_sort = 'done' then p.status = 'done'
              else p.status in ('open', 'review', 'planned') end)
  order by
    case when p_sort = 'top' and not p_mine then p.votes_count end desc nulls last,
    coalesce(p.published_at, p.created_at) desc
  limit least(greatest(p_limit, 1), 200);
$$;
revoke all on function public.proposals_feed(text, boolean, integer) from public, anon;
grant execute on function public.proposals_feed(text, boolean, integer) to authenticated;

create or replace function public.proposal_get(p_id uuid)
returns table (
  id uuid, title text, body text, topic text, tool_name text, status text, votes_count integer,
  staff_reply text, staff_note text, created_at timestamptz, published_at timestamptz, status_changed_at timestamptz,
  author_name text, is_mine boolean, my_vote boolean, my_report boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.body, p.topic, p.tool_name, p.status, p.votes_count,
         p.staff_reply, case when p.author_id = auth.uid() then p.staff_note end, p.created_at, p.published_at, p.status_changed_at,
         public.proposal_author_name(p.author_id), p.author_id = auth.uid(),
         exists (select 1 from public.community_proposal_votes v where v.proposal_id = p.id and v.user_id = auth.uid()),
         exists (select 1 from public.community_proposal_reports r where r.proposal_id = p.id and r.user_id = auth.uid())
  from public.community_proposals p
  where p.id = p_id and auth.uid() is not null
    and (p.status in ('open', 'review', 'planned', 'done', 'declined') or p.author_id = auth.uid());
$$;
revoke all on function public.proposal_get(uuid) from public, anon;
grant execute on function public.proposal_get(uuid) to authenticated;

-- Proposte simili già pubblicate (per non fare doppioni)
create or replace function public.proposals_similar(p_text text)
returns table (id uuid, title text, votes_count integer, status text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.votes_count, p.status
  from public.community_proposals p
  where auth.uid() is not null and char_length(trim(p_text)) >= 6
    and p.status in ('open', 'review', 'planned', 'done')
    and extensions.word_similarity(lower(trim(p_text)), lower(p.title)) > 0.35
  order by extensions.word_similarity(lower(trim(p_text)), lower(p.title)) desc, p.votes_count desc
  limit 3;
$$;
revoke all on function public.proposals_similar(text) from public, anon;
grant execute on function public.proposals_similar(text) to authenticated;

-- Nuova proposta (o proposta corretta dopo una richiesta di modifica)
create or replace function public.proposal_save(p_id uuid, p_title text, p_body text, p_topic text, p_tool text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_plan text;
  v_week integer;
  v_pending integer;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  if not exists (select 1 from public.tool_access(v_uid, 'proposte') x where x.allowed) then raise exception 'disabled'; end if;
  if p_topic not in ('existing', 'new', 'app') then raise exception 'invalid'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 8 and 90 or char_length(trim(coalesce(p_body, ''))) not between 20 and 1200 then raise exception 'invalid'; end if;

  if p_id is not null then
    update public.community_proposals
       set title = trim(p_title), body = trim(p_body), topic = p_topic,
           tool_name = case when p_topic = 'existing' then left(nullif(trim(p_tool), ''), 60) end,
           status = 'pending', staff_note = null, updated_at = now(), status_changed_at = now()
     where id = p_id and author_id = v_uid and status = 'changes'
     returning id into v_id;
    if v_id is null then raise exception 'not_editable'; end if;
    return v_id;
  end if;

  v_plan := coalesce(public.plan_of(v_uid), 'none');
  if v_plan not in ('base', 'pro') and not public.admin_is_staff(v_uid) then raise exception 'plan_required'; end if;
  select count(*) into v_week from public.community_proposals where author_id = v_uid and created_at > now() - interval '7 days';
  if v_week >= coalesce(public.app_limit('proposals_per_week'), 1) and not public.admin_is_staff(v_uid) then raise exception 'weekly_limit'; end if;
  select count(*) into v_pending from public.community_proposals where author_id = v_uid and status in ('pending', 'changes');
  if v_pending >= coalesce(public.app_limit('proposals_pending'), 3) then raise exception 'pending_limit'; end if;

  insert into public.community_proposals (author_id, area, topic, tool_name, title, body)
  values (v_uid, 'kumani', p_topic, case when p_topic = 'existing' then left(nullif(trim(p_tool), ''), 60) end, trim(p_title), trim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.proposal_save(uuid, text, text, text, text) from public, anon;
grant execute on function public.proposal_save(uuid, text, text, text, text) to authenticated;

-- Sostegno: solo proposte aperte, non le proprie
create or replace function public.proposal_vote(p_id uuid, p_on boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  if not exists (select 1 from public.tool_access(v_uid, 'proposte') x where x.allowed) then raise exception 'disabled'; end if;
  if not exists (select 1 from public.community_proposals where id = p_id and status in ('open', 'review', 'planned') and author_id is distinct from v_uid) then
    raise exception 'not_votable';
  end if;
  if p_on then
    insert into public.community_proposal_votes (proposal_id, user_id) values (p_id, v_uid) on conflict do nothing;
  else
    delete from public.community_proposal_votes where proposal_id = p_id and user_id = v_uid;
  end if;
  select votes_count into v_count from public.community_proposals where id = p_id;
  return v_count;
end;
$$;
revoke all on function public.proposal_vote(uuid, boolean) from public, anon;
grant execute on function public.proposal_vote(uuid, boolean) to authenticated;

create or replace function public.proposal_report(p_id uuid, p_reason text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_logged_in'; end if;
  if not exists (select 1 from public.community_proposals where id = p_id and status in ('open', 'review', 'planned', 'done', 'declined')) then raise exception 'not_found'; end if;
  insert into public.community_proposal_reports (proposal_id, user_id, reason, note)
  values (p_id, auth.uid(), p_reason, left(nullif(trim(p_note), ''), 300))
  on conflict (proposal_id, user_id) do nothing;
end;
$$;
revoke all on function public.proposal_report(uuid, text, text) from public, anon;
grant execute on function public.proposal_report(uuid, text, text) to authenticated;

-- Staff: pubblica, chiede modifiche, rifiuta, aggiorna lo stato e risponde.
-- Realizzata → KU Karma all'autore, una volta sola.
create or replace function public.proposal_staff_set(p_id uuid, p_status text, p_reply text, p_note text)
returns table (author_id uuid, title text, old_status text, new_status text, rewarded_ku integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  p record;
  v_ku integer := 0;
begin
  if not public.admin_is_staff(auth.uid()) then raise exception 'not_staff'; end if;
  if p_status not in ('changes', 'rejected', 'open', 'review', 'planned', 'done', 'declined') then raise exception 'invalid'; end if;
  select * into p from public.community_proposals where id = p_id for update;
  if p.id is null then raise exception 'not_found'; end if;

  update public.community_proposals
     set status = p_status,
         staff_reply = case when p_reply is null then staff_reply else left(nullif(trim(p_reply), ''), 1000) end,
         staff_note = case when p_status in ('changes', 'rejected') then left(nullif(trim(p_note), ''), 300) else null end,
         published_at = case when published_at is null and p_status in ('open', 'review', 'planned', 'done', 'declined') then now() else published_at end,
         status_changed_at = case when status is distinct from p_status then now() else status_changed_at end,
         updated_at = now()
   where id = p_id;

  if p_status = 'done' and not p.rewarded and p.author_id is not null then
    v_ku := coalesce(public.ku_points_for('proposal_done'), 0);
    if v_ku > 0 then
      update public.profiles set daily_points = coalesce(daily_points, 0) + v_ku, ku_earned_total = coalesce(ku_earned_total, 0) + v_ku where id = p.author_id;
    end if;
    update public.community_proposals set rewarded = true where id = p_id;
  end if;

  return query select p.author_id, p.title, p.status, p_status, v_ku;
end;
$$;
revoke all on function public.proposal_staff_set(uuid, text, text, text) from public, anon;
grant execute on function public.proposal_staff_set(uuid, text, text, text) to authenticated;

create or replace function public.admin_section_badges()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

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

    'withdrawals', nullif((select count(*) from public.withdrawal_requests where status = 'pending' and requested_at > coalesce((seen ->> 'withdrawals')::timestamptz, v_default)), 0),

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

                     + (select count(*) from public.timebank_reports where status = 'open' and created_at > coalesce((seen ->> 'timebank')::timestamptz, v_default)), 0),

    'mosaic', nullif((select count(*) from public.mosaic_reports where status = 'open' and created_at > coalesce((seen ->> 'mosaic')::timestamptz, v_default)), 0),

    'fabula', nullif((select count(*) from public.fabula_stories where status in ('pending', 'hidden') and updated_at > coalesce((seen ->> 'fabula')::timestamptz, v_default))

                   + (select count(*) from public.fabula_reports where status = 'open' and created_at > coalesce((seen ->> 'fabula')::timestamptz, v_default)), 0),
    'proposals', nullif((select count(*) from public.community_proposals where status = 'pending')
                      + (select count(*) from public.community_proposal_reports where status = 'open'), 0)

  ));

end;

$function$;
