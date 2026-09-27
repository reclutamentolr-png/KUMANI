-- Cancellazione dell'account su richiesta (GDPR, art. 17).
-- Non si può eliminare fisicamente il profilo senza rompere la rete (sponsor
-- e matrice puntano a lui): si ANONIMIZZA in modo irreversibile. Si cancellano
-- i contenuti personali, si svuotano i dati anagrafici e l'accesso viene chiuso
-- (email e password dell'account sostituite dal server). Restano solo i dati
-- che servono ad altri utenti o che la legge impone di conservare (movimenti
-- contabili, posizione anonima nella rete, eventi e Kordate con altri).

alter table public.profiles add column if not exists deleted_at timestamptz;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  reason text check (char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  staff_note text,
  -- Per la prova dell'avvenuta cancellazione senza conservare l'email in chiaro
  email_hash text
);
create unique index if not exists account_deletion_one_pending on public.account_deletion_requests(user_id) where status = 'pending';
alter table public.account_deletion_requests enable row level security;
drop policy if exists account_deletion_own on public.account_deletion_requests;
create policy account_deletion_own on public.account_deletion_requests for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.account_deletion_requests to authenticated;

create or replace function public.account_request_deletion(p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return 'not_allowed';
  end if;
  if exists (select 1 from public.account_deletion_requests where user_id = auth.uid() and status = 'pending') then
    return 'pending';
  end if;
  insert into public.account_deletion_requests (user_id, reason)
  values (auth.uid(), nullif(left(trim(coalesce(p_reason, '')), 1000), ''));
  return 'ok';
end;
$$;

create or replace function public.account_cancel_deletion()
returns text
language sql
security definer
set search_path = public
as $$
  update public.account_deletion_requests set status = 'cancelled', processed_at = now()
  where user_id = auth.uid() and status = 'pending'
  returning 'ok';
$$;

revoke all on function public.account_request_deletion(text) from public, anon;
revoke all on function public.account_cancel_deletion() from public, anon;
grant execute on function public.account_request_deletion(text), public.account_cancel_deletion() to authenticated;

-- Anonimizzazione (solo server/Staff): cancella i contenuti personali e
-- svuota il profilo. L'accesso (auth) lo chiude il server con l'API admin.
create or replace function public.account_anonymize(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
begin
  -- Strumenti personali
  delete from public.notes where user_id = p_uid;
  delete from public.tasks where user_id = p_uid;
  delete from public.appointments where user_id = p_uid;
  delete from public.contacts where user_id = p_uid;
  delete from public.bills where user_id = p_uid;
  delete from public.spendly_fixed_payments where user_id = p_uid;
  delete from public.spendly_fixed_expenses where user_id = p_uid;
  delete from public.spendly_variable_expenses where user_id = p_uid;
  delete from public.spendly_income where user_id = p_uid;
  delete from public.life_calendar_items where user_id = p_uid;
  delete from public.life_calendar_profiles where user_id = p_uid;
  delete from public.findo_items where user_id = p_uid;
  delete from public.findo_locations where user_id = p_uid;
  delete from public.digital_receipts where user_id = p_uid;
  delete from public.quotes where user_id = p_uid;
  delete from public.quote_clients where user_id = p_uid;
  delete from public.quote_issuer_profiles where user_id = p_uid;
  delete from public.cvs where user_id = p_uid;
  delete from public.link_in_bio where user_id = p_uid;
  delete from public.qr_pro_codes where user_id = p_uid;
  delete from public.offermaker_campaigns where user_id = p_uid;
  delete from public.offermaker_ai_usage where owner_id = p_uid;
  delete from public.menus where owner_id = p_uid;
  delete from public.menu_ai_usage where owner_id = p_uid;
  delete from public.fidelity_cards where owner_id = p_uid;
  delete from public.aureya_test_results where user_id = p_uid;
  delete from public.marketplace_favorites where user_id = p_uid;
  delete from public.marketplace_usage where user_id = p_uid;
  delete from public.daily_tool_points where user_id = p_uid;
  -- Community
  delete from public.listings where user_id = p_uid;
  delete from public.messages where sender_id = p_uid or receiver_id = p_uid;
  delete from public.spotlight_profiles where user_id = p_uid;
  delete from public.affinity_messages where sender_id = p_uid;
  delete from public.affinity_intros where user_a = p_uid or user_b = p_uid;
  delete from public.affinity_blocks where blocker = p_uid or blocked = p_uid;
  delete from public.affinity_profiles where user_id = p_uid;
  delete from public.convivio_messages where sender_id = p_uid;
  delete from public.convivio_pledges where user_id = p_uid and group_id in (select id from public.convivio_groups where status = 'open');
  update public.convivio_groups set status = 'cancelled', updated_at = now() where leader_id = p_uid and status = 'open';
  delete from public.convivio_suppliers where user_id = p_uid;
  delete from public.convivio_reviews where reviewer = p_uid;
  -- Eventi: i futuri che organizzava vengono annullati; le sue iscrizioni tolte
  update public.events set status = 'cancelled', updated_at = now()
  where organizer_id = p_uid and status in ('pending', 'published') and starts_at > now();
  for v_event in select event_id from public.event_participants where user_id = p_uid and status in ('registered', 'waitlist') loop
    update public.event_participants set status = 'cancelled' where event_id = v_event and user_id = p_uid;
    perform public.event_promote_waitlist(v_event);
  end loop;
  delete from public.event_reviews where reviewer = p_uid;
  -- Viaggi: i documenti personali si cancellano; la partecipazione resta
  -- (i conti del gruppo devono tornare) con il nome anonimo
  delete from public.trip_documents where member_id in (select id from public.trip_members where user_id = p_uid);
  -- Richieste e verifiche
  delete from public.identity_verifications where user_id = p_uid;
  delete from public.profile_change_requests where user_id = p_uid;
  delete from public.admin_message_reads where user_id = p_uid;
  delete from public.contact_messages where user_id = p_uid;
  delete from public.wallet_coupons where user_id = p_uid and redeemed_at is null;

  -- Profilo: dati anagrafici svuotati, accesso bloccato
  update public.profiles set
    first_name = 'Utente',
    last_name = 'eliminato',
    email = 'deleted-' || p_uid::text || '@deleted.invalid',
    username = 'deleted_' || replace(p_uid::text, '-', ''),
    phone = null,
    address = null,
    city = null,
    province = null,
    postal_code = null,
    occupation = null,
    gender = null,
    date_of_birth = date '2000-01-01',
    tax_code = null,
    is_blocked = true,
    is_active = false,
    subscription_status = 'free',
    subscription_expires_at = now(),
    pro_trial_ends_at = null,
    deleted_at = now()
  where id = p_uid;
end;
$$;
revoke all on function public.account_anonymize(uuid) from public, anon, authenticated;

-- Pallino oro in Admin per le richieste di cancellazione
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
    'contactMessages', nullif((select count(*) from public.contact_messages where status = 'new' and created_at > coalesce((seen ->> 'contactMessages')::timestamptz, v_default)), 0)
  ));
end;
$$;
