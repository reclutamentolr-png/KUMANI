-- 1. Profilo completo: anche provincia e CAP sono obbligatori.
-- 2. Pallini Admin: contano solo ciò che è arrivato dopo l'ultima apertura di
--    quella sezione da parte di questo admin (aprendola il pallino sparisce).

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
     and nullif(trim(coalesce(p.province, '')), '') is not null
     and nullif(trim(coalesce(p.postal_code, '')), '') is not null
     and nullif(trim(coalesce(p.address, '')), '') is not null
     and nullif(trim(coalesce(p.occupation, '')), '') is not null;
$$;

-- Chi era già "completo" ma senza provincia o CAP torna da completare
-- (prima che il blocco scatti, può ancora inserirli).
update public.profiles p set profile_completed_at = null
where p.profile_completed_at is not null and not public.profile_fields_complete(p);

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
  s_users timestamptz; s_requests timestamptz; s_listing timestamptz; s_spotlight timestamptz;
  s_affinity timestamptz; s_convivio timestamptz; s_events timestamptz; s_identity timestamptz;
  s_fees timestamptz; s_rewards timestamptz; s_contact timestamptz;
begin
  if v_uid is null or not public.admin_is_staff(v_uid) then
    return '{}'::jsonb;
  end if;
  select coalesce(jsonb_object_agg(section, seen_at), '{}'::jsonb) into seen from public.admin_section_seen where admin_id = v_uid;
  s_users := coalesce((seen ->> 'users')::timestamptz, v_default);
  s_requests := coalesce((seen ->> 'profileRequests')::timestamptz, v_default);
  s_listing := coalesce((seen ->> 'listingReports')::timestamptz, v_default);
  s_spotlight := coalesce((seen ->> 'spotlight')::timestamptz, v_default);
  s_affinity := coalesce((seen ->> 'affinity')::timestamptz, v_default);
  s_convivio := coalesce((seen ->> 'convivio')::timestamptz, v_default);
  s_events := coalesce((seen ->> 'events')::timestamptz, v_default);
  s_identity := coalesce((seen ->> 'identity')::timestamptz, v_default);
  s_fees := coalesce((seen ->> 'convivioFees')::timestamptz, v_default);
  s_rewards := coalesce((seen ->> 'rewards')::timestamptz, v_default);
  s_contact := coalesce((seen ->> 'contactMessages')::timestamptz, v_default);
  return jsonb_strip_nulls(jsonb_build_object(
    'users', nullif((select count(*) from public.profiles where created_at > s_users), 0),
    'profileRequests', nullif((select count(*) from public.profile_change_requests where status = 'pending' and created_at > s_requests), 0),
    'listingReports', nullif((select count(*) from public.listing_reports where created_at > s_listing), 0),
    'spotlight', nullif((select count(*) from public.spotlight_profiles where moderation_status = 'pending' and updated_at > s_spotlight), 0),
    'affinity', nullif((select count(*) from public.affinity_reports where status = 'open' and created_at > s_affinity), 0),
    'convivio', nullif((select count(*) from public.convivio_reports where status = 'open' and created_at > s_convivio)
                     + (select count(*) from public.convivio_groups where created_at > s_convivio), 0),
    'events', nullif((select count(*) from public.events where status = 'pending' and updated_at > s_events)
                   + (select count(*) from public.event_reports where status = 'open' and created_at > s_events)
                   + (select count(*) from public.events where status = 'published' and created_at > s_events), 0),
    'identity', nullif((select count(*) from public.identity_verifications where status = 'pending' and created_at > s_identity), 0),
    'convivioFees', nullif((select count(*) from public.convivio_fees where created_at > s_fees), 0),
    'rewards', nullif((select count(*) from public.reward_redemptions where fulfilled_at is null and redeemed_at > s_rewards), 0),
    'contactMessages', nullif((select count(*) from public.contact_messages where status = 'new' and created_at > s_contact), 0)
  ));
end;
$$;
