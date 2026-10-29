-- Admin → Bacheca: il pallino conta anche gli annunci in attesa di
-- approvazione (prima solo le segnalazioni). Il resto della funzione è
-- uguale alla versione in produzione.
CREATE OR REPLACE FUNCTION public.admin_section_badges()
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
    -- Bacheca: annunci in attesa di approvazione (restano finché non vengono
    -- approvati o rifiutati) + segnalazioni nuove
    'listingReports', nullif((select count(*) from public.listings where review_status = 'pending')
                           + (select count(*) from public.listing_reports where created_at > coalesce((seen ->> 'listingReports')::timestamptz, v_default)), 0),
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
