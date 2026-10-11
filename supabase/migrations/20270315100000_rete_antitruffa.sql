-- Rete Anti-Truffa: gli iscritti segnalano numeri, siti, IBAN, email,
-- profili social e QR code usati per truffe. Lo Staff conferma e da quel
-- momento chi controlla lo stesso dato (SVAT, Verifica IBAN, CheckMail,
-- «Chi mi ha chiamato?») vede l'avviso della community. Chi segnala resta
-- anonimo. Tutto si legge e si scrive dal server (chiave di servizio).

insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('rete-antitruffa', true, 'free', 'Rete Anti-Truffa – segnalazioni della community, allerta e controllo dei numeri')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('scam_report_confirmed', 'Segnalazione anti-truffa confermata', 2, 91)
on conflict (key) do nothing;

insert into public.app_limits (key, value, kind, section, label, sort)
values ('scam_reports_per_day', 5, 'count', 'Rete Anti-Truffa', 'Segnalazioni al giorno per persona', 90),
       ('files_scam-evidence', 30, 'files', 'Rete Anti-Truffa', 'Prove (screenshot) in attesa per persona', 91)
on conflict (key) do nothing;

create table if not exists public.scam_targets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('phone', 'site', 'iban', 'email', 'social', 'qr')),
  value_key text not null check (char_length(value_key) between 2 and 300),
  display text not null check (char_length(display) between 2 and 300),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed', 'removed')),
  category text,
  reports_count integer not null default 0,
  confirmed_reports integer not null default 0,
  hits integer not null default 0,
  first_report_at timestamptz not null default now(),
  last_report_at timestamptz not null default now(),
  confirmed_at timestamptz,
  decided_at timestamptz,
  staff_note text check (staff_note is null or char_length(staff_note) <= 300),
  unique (kind, value_key)
);
create index if not exists scam_targets_status_idx on public.scam_targets (status, last_report_at desc);

create table if not exists public.scam_reports (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.scam_targets (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  category text not null check (category in ('courier', 'bank', 'investment', 'romance', 'rental', 'marketplace', 'job', 'support', 'prize', 'phishing', 'other')),
  description text check (description is null or char_length(description) <= 600),
  evidence_path text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed', 'needs_info')),
  staff_note text check (staff_note is null or char_length(staff_note) <= 300),
  rewarded boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (target_id, user_id)
);
create index if not exists scam_reports_user_idx on public.scam_reports (user_id, created_at desc);
create index if not exists scam_reports_created_idx on public.scam_reports (created_at desc);

-- Controlli che hanno mostrato un avviso (per «hai messo in guardia N persone» e l'allerta)
create table if not exists public.scam_hits (
  id bigint generated always as identity primary key,
  target_id uuid not null references public.scam_targets (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists scam_hits_target_idx on public.scam_hits (target_id, created_at);
create index if not exists scam_hits_created_idx on public.scam_hits (created_at);

-- Il titolare di un numero o di un sito segnalato per errore può contestare
create table if not exists public.scam_contests (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.scam_targets (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  message text not null check (char_length(message) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.scam_targets enable row level security;
alter table public.scam_reports enable row level security;
alter table public.scam_hits enable row level security;
alter table public.scam_contests enable row level security;
-- Nessuna regola: solo il server (chiave di servizio) legge e scrive

-- Decisione dello Staff su un dato segnalato: conferma, scarta, chiede prove.
-- Restituisce chi ha segnalato (per le notifiche) e le prove da cancellare.
create or replace function public.scam_staff_decide(p_target uuid, p_decision text, p_note text default null)
returns table (user_id uuid, report_id uuid, evidence_path text, rewarded_ku integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ku integer := coalesce(public.ku_points_for('scam_report_confirmed'), 0);
  r record;
begin
  if p_decision not in ('confirm', 'dismiss', 'needs_info', 'remove') then
    raise exception 'invalid';
  end if;
  if p_decision = 'confirm' then
    update public.scam_targets
    set status = 'confirmed', confirmed_at = coalesce(confirmed_at, now()), decided_at = now(), staff_note = left(p_note, 300)
    where id = p_target;
    for r in select * from public.scam_reports where target_id = p_target and status in ('pending', 'needs_info') for update loop
      update public.scam_reports set status = 'confirmed', decided_at = now(), evidence_path = null, rewarded = true where id = r.id;
      if r.user_id is not null and not r.rewarded and v_ku > 0 then
        update public.profiles set daily_points = coalesce(daily_points, 0) + v_ku, ku_earned_total = coalesce(ku_earned_total, 0) + v_ku where id = r.user_id;
      end if;
      user_id := r.user_id; report_id := r.id; evidence_path := r.evidence_path; rewarded_ku := case when r.rewarded then 0 else v_ku end;
      return next;
    end loop;
    update public.scam_targets t
    set confirmed_reports = (select count(*) from public.scam_reports x where x.target_id = t.id and x.status = 'confirmed')
    where t.id = p_target;
  elsif p_decision = 'dismiss' then
    update public.scam_targets set status = 'dismissed', decided_at = now(), staff_note = left(p_note, 300) where id = p_target and status <> 'confirmed';
    for r in select * from public.scam_reports where target_id = p_target and status in ('pending', 'needs_info') for update loop
      update public.scam_reports set status = 'dismissed', decided_at = now(), evidence_path = null, staff_note = left(p_note, 300) where id = r.id;
      user_id := r.user_id; report_id := r.id; evidence_path := r.evidence_path; rewarded_ku := 0;
      return next;
    end loop;
  elsif p_decision = 'needs_info' then
    for r in select * from public.scam_reports where target_id = p_target and status = 'pending' for update loop
      update public.scam_reports set status = 'needs_info', staff_note = left(p_note, 300) where id = r.id;
      user_id := r.user_id; report_id := r.id; evidence_path := null; rewarded_ku := 0;
      return next;
    end loop;
  else
    -- Ritiro (contestazione accolta o errore): l'avviso non compare più
    update public.scam_targets set status = 'removed', decided_at = now(), staff_note = left(p_note, 300) where id = p_target;
  end if;
end;
$$;
revoke all on function public.scam_staff_decide(uuid, text, text) from public, anon, authenticated;

-- Contatori di un dato dopo una nuova segnalazione (anche ricalcolo)
create or replace function public.scam_target_refresh(p_target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.scam_targets t
  set reports_count = (select count(*) from public.scam_reports x where x.target_id = t.id and x.status <> 'dismissed'),
      confirmed_reports = (select count(*) from public.scam_reports x where x.target_id = t.id and x.status = 'confirmed'),
      last_report_at = coalesce((select max(created_at) from public.scam_reports x where x.target_id = t.id), t.last_report_at)
  where t.id = p_target;
$$;
revoke all on function public.scam_target_refresh(uuid) from public, anon, authenticated;

-- Pulizia: avvisi senza nuove segnalazioni da 13 mesi, controlli dopo 120 giorni
create or replace function public.scam_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.scam_hits where created_at < now() - interval '120 days';
  delete from public.scam_targets where last_report_at < now() - interval '13 months';
$$;
revoke all on function public.scam_cleanup() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'kumani-scam-cleanup';
    perform cron.schedule('kumani-scam-cleanup', '55 3 * * *', 'select public.scam_cleanup()');
  end if;
end;
$$;

-- Prove (screenshot): cartella privata di chi segnala; lo Staff le vede con link firmati
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scam-evidence', 'scam-evidence', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists scam_evidence_insert on storage.objects;
create policy scam_evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'scam-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists scam_evidence_select on storage.objects;
create policy scam_evidence_select on storage.objects for select to authenticated
  using (bucket_id = 'scam-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists scam_evidence_delete on storage.objects;
create policy scam_evidence_delete on storage.objects for delete to authenticated
  using (bucket_id = 'scam-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Notifica settimanale «le truffe della settimana»: facoltativa, spenta finché non la si accende
alter table public.push_preferences add column if not exists alerts boolean not null default false;
alter table public.user_notifications drop constraint if exists user_notifications_category_check;
alter table public.user_notifications add constraint user_notifications_category_check
  check (category in ('network', 'expiry', 'events', 'staff', 'messages', 'alerts'));

-- Contatore nel menu dell'Admin
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
                      + (select count(*) from public.community_proposal_reports where status = 'open'), 0),
    'antitruffa', nullif((select count(*) from public.scam_targets where status = 'pending')
                       + (select count(*) from public.scam_contests where status = 'open'), 0)

  ));

end;

$function$;
