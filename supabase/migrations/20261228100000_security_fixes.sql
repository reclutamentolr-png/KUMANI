-- Correzioni di sicurezza dal controllo di ottobre 2026.
-- 1. Limiti giornalieri dell'AI (OfferMaker e KUMANI Menu) contati in modo
--    atomico: niente più azzeramento del contatore da parte dell'utente né
--    richieste in parallelo che superano il limite.
-- 2. PIN della cassa Kumi Card: ogni tentativo si conta prima di provare il
--    PIN, in modo atomico (anche con molte richieste insieme).
-- 3. Biglietto da visita pubblico solo per chi l'ha creato, mai per gli agenti.
-- 4. Ruoli Staff: nessun permesso di scrittura per gli utenti (oltre alle
--    regole RLS che già lo impedivano).
-- 5. Bucket pubblici: solo immagini e dimensione massima.

-- 1. Quota AI ------------------------------------------------------------
revoke insert, update, delete on public.offermaker_ai_usage from authenticated, anon;
drop policy if exists "offermaker_ai_usage_own" on public.offermaker_ai_usage;
drop policy if exists offermaker_ai_usage_select_own on public.offermaker_ai_usage;
create policy offermaker_ai_usage_select_own on public.offermaker_ai_usage
  for select to authenticated using (owner_id = (select auth.uid()));

-- Prende un utilizzo dalla quota del giorno. Restituisce gli utilizzi fatti
-- (compreso questo) oppure null se il limite è già raggiunto.
create or replace function public.ai_quota_take(p_kind text, p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runs integer;
  v_day date := (now() at time zone 'utc')::date; -- come il resto del codice (data UTC)
begin
  if p_limit is null or p_limit <= 0 or p_user is null then
    return null;
  end if;
  if p_kind = 'offermaker' then
    insert into public.offermaker_ai_usage as u (owner_id, used_on, runs)
    values (p_user, v_day, 1)
    on conflict (owner_id, used_on) do update set runs = u.runs + 1 where u.runs < p_limit
    returning u.runs into v_runs;
  elsif p_kind = 'menu' then
    insert into public.menu_ai_usage as u (owner_id, used_on, runs)
    values (p_user, v_day, 1)
    on conflict (owner_id, used_on) do update set runs = u.runs + 1 where u.runs < p_limit
    returning u.runs into v_runs;
  else
    raise exception 'unknown_kind';
  end if;
  return v_runs;
end;
$$;
revoke all on function public.ai_quota_take(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_quota_take(text, uuid, integer) to service_role;

-- 2. PIN della cassa ------------------------------------------------------
-- 'locked' = cassa bloccata (anche da questo tentativo, se era l'ultimo
-- concesso), 'try' = tentativo contato: si può verificare il PIN,
-- 'notfound' = tessera inesistente.
create or replace function public.fidelity_pin_attempt(p_card uuid, p_max integer, p_lock_minutes integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card record;
begin
  select pin_failed_attempts, pin_locked_until into v_card
  from public.fidelity_cards where id = p_card for update;
  if not found then
    return 'notfound';
  end if;
  if v_card.pin_locked_until is not null and v_card.pin_locked_until > now() then
    return 'locked';
  end if;
  if coalesce(v_card.pin_failed_attempts, 0) + 1 > p_max then
    update public.fidelity_cards
    set pin_failed_attempts = 0, pin_locked_until = now() + make_interval(mins => p_lock_minutes)
    where id = p_card;
    return 'locked';
  end if;
  update public.fidelity_cards set pin_failed_attempts = coalesce(pin_failed_attempts, 0) + 1 where id = p_card;
  return 'try';
end;
$$;
revoke all on function public.fidelity_pin_attempt(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.fidelity_pin_attempt(uuid, integer, integer) to service_role;

-- 3. Biglietto da visita --------------------------------------------------
create or replace function public.get_business_card(p_code text)
returns table (first_name text, last_name text, referral_code text, phone text, whatsapp text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.first_name::text, p.last_name::text, p.referral_code::text,
         case when c.show_phone then nullif(trim(p.phone), '') end,
         case when c.show_whatsapp then nullif(trim(p.phone), '') end,
         case when c.show_email then nullif(trim(p.email), '') end
  from public.profiles p
  join public.business_cards c on c.user_id = p.id
  where p.referral_code = upper(trim(p_code))
    and not coalesce(p.is_blocked, false)
    and p.deleted_at is null
    and not exists (select 1 from public.agents ag where ag.user_id = p.id)
  limit 1;
$$;
revoke all on function public.get_business_card(text) from public;
grant execute on function public.get_business_card(text) to anon, authenticated;

-- 4. Ruoli Staff ----------------------------------------------------------
revoke insert, update, delete on public.admin_users from authenticated, anon;
revoke insert, update, delete on public.admin_roles from authenticated, anon;

-- 5. Bucket pubblici: solo immagini, al massimo 10 MB ----------------------
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    file_size_limit = 10485760
where id in ('cv-photos', 'receipt-photos-v2');

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    file_size_limit = 5242880
where id = 'quote-logos-v2';

-- 6. Profili: ognuno legge solo il proprio (lo Staff ha la sua regola).
--    Prima ogni utente collegato poteva leggere di tutti chi ha invitato
--    chi, chi è admin, abbonamento, punti e ultimo accesso.
drop policy if exists profiles_select_authenticated on public.profiles;

-- 7. Ricevute digitali: la conferma la dà solo il destinatario
--    (confirm_digital_receipt), mai l'autore della ricevuta.
create or replace function public.digital_receipts_guard_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.confirmed_at := null;
    else
      new.confirmed_at := old.confirmed_at;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists digital_receipts_guard_confirmation on public.digital_receipts;
create trigger digital_receipts_guard_confirmation
  before insert or update on public.digital_receipts
  for each row execute function public.digital_receipts_guard_confirmation();

-- 8. Segnalazioni SVAT: ognuno vede solo le proprie (i conteggi per QR li
--    calcola il server).
drop policy if exists "Authenticated users can read aggregated reports" on public.svat_qc_reports;
drop policy if exists svat_qc_reports_select_own on public.svat_qc_reports;
create policy svat_qc_reports_select_own on public.svat_qc_reports
  for select to authenticated using (user_id = (select auth.uid()));

-- 9. Trova Lavoro: il rimborso di una ricerca fallita lo fa solo il server
revoke all on function public.refund_job_search(uuid) from public, anon, authenticated;
create or replace function public.refund_job_search_for(p_run_id uuid, p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.job_search_runs
  where id = p_run_id and user_id = p_user and created_at > now() - interval '15 minutes';
$$;
revoke all on function public.refund_job_search_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.refund_job_search_for(uuid, uuid) to service_role;

-- 10. Pacchetti voucher: niente indici negativi
create or replace function public.redeem_voucher_pack(p_index integer)
returns table (success boolean, reason text, new_network_points integer, new_credit_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_packs jsonb := public.voucher_packs();
  v_pack jsonb;
  v_points int;
  v_cents int;
  v_spend record;
  v_credit int;
  v_redeemed smallint[];
begin
  if auth.uid() is null then
    return;
  end if;
  -- Solo indici validi: in jsonb un indice negativo conta dalla fine
  if p_index is null or p_index < 0 or p_index >= jsonb_array_length(v_packs) then
    return query select false, 'not_found', coalesce((select network_points from profiles where id = auth.uid()), 0), coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;
  v_pack := v_packs -> p_index;
  if v_pack is null then
    return query select false, 'not_found', coalesce((select network_points from profiles where id = auth.uid()), 0), coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  select coalesce(voucher_packs_redeemed, '{}') into v_redeemed from profiles where id = auth.uid() for update;
  if p_index = any(v_redeemed) then
    return query select false, 'already_redeemed', coalesce((select network_points from profiles where id = auth.uid()), 0), coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  v_points := (v_pack ->> 'points')::int;
  v_cents := (v_pack ->> 'credit_eur')::int * 100;

  select * into v_spend from public.spend_network_points(v_points);
  if not v_spend.success then
    return query select false, 'insufficient_points', v_spend.new_network_points, coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  -- Pacchetto preso; presi tutti → il ciclo ricomincia
  v_redeemed := array_append(v_redeemed, p_index::smallint);
  if cardinality(v_redeemed) >= jsonb_array_length(v_packs) then
    v_redeemed := '{}';
  end if;

  update profiles
  set voucher_credit_cents = coalesce(voucher_credit_cents, 0) + v_cents,
      voucher_packs_redeemed = v_redeemed
  where id = auth.uid()
  returning voucher_credit_cents into v_credit;

  insert into public.voucher_credit_movements (user_id, kind, points_spent, cents) values (auth.uid(), 'pack', v_points, v_cents);
  return query select true, null::text, v_spend.new_network_points, v_credit;
end;
$$;

-- 11. FinCheck: due salvataggi insieme non danno due volte i KU Karma
create or replace function public.fincheck_save(p_answers smallint[])
returns table (result_id uuid, total integer, ku_awarded integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_areas smallint[] := '{}';
  v_total int := 0;
  v_ku int := 0;
  v_id uuid;
  i int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  -- Un test alla volta per persona (due salvataggi insieme non danno due premi)
  perform pg_advisory_xact_lock(hashtext('fincheck:' || v_uid::text));
  if p_answers is null or array_length(p_answers, 1) <> 15 then
    raise exception 'invalid_answers';
  end if;
  for i in 1..15 loop
    if p_answers[i] is null or p_answers[i] < 0 or p_answers[i] > 3 then
      raise exception 'invalid_answers';
    end if;
  end loop;
  for i in 0..4 loop
    v_areas := v_areas || (p_answers[i * 3 + 1] + p_answers[i * 3 + 2] + p_answers[i * 3 + 3])::smallint;
    v_total := v_total + p_answers[i * 3 + 1] + p_answers[i * 3 + 2] + p_answers[i * 3 + 3];
  end loop;

  -- Un test salvato a persona ogni 10 secondi al massimo (niente raffiche)
  if exists (select 1 from public.fincheck_results fr where fr.user_id = v_uid and fr.created_at > now() - interval '10 seconds') then
    raise exception 'too_fast';
  end if;

  -- KU Karma: primo test, poi solo se l'ultimo premiato ha almeno 90 giorni
  if exists (select 1 from public.tool_access(v_uid, 'fincheck') t where t.allowed)
     and not exists (
       select 1 from public.fincheck_results fr
       where fr.user_id = v_uid and fr.ku_awarded > 0 and fr.created_at > now() - interval '90 days'
     ) then
    v_ku := public.ku_points_for('fincheck');
  end if;

  insert into public.fincheck_results (user_id, answers, area_scores, total, ku_awarded)
  values (v_uid, p_answers, v_areas, v_total, v_ku)
  returning id into v_id;

  if v_ku > 0 then
    update public.profiles
    set daily_points = coalesce(daily_points, 0) + v_ku,
        ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
    where id = v_uid;
  end if;

  return query select v_id, v_total, v_ku;
end;
$$;
revoke all on function public.fincheck_save(smallint[]) from public, anon;
grant execute on function public.fincheck_save(smallint[]) to authenticated;

-- 12. Funzioni per utenti collegati: non chiamabili da chi non ha un account
--     (user_has_active_subscription, spotlight_owner_has_active_subscription e
--     is_user_blocked restano: le usano le regole delle pagine pubbliche)
do $$
declare f text;
begin
  foreach f in array array[
    'award_tool_point(text)', 'cancel_my_voucher(uuid)', 'claim_matrix_slot_bonus()',
    'create_subscription_voucher(text, text, integer)', 'feature_listing(uuid, integer)',
    'my_donations()', 'my_network_wallet()', 'redeem_reward(uuid)',
    'redeem_subscription_voucher(text)', 'redeem_voucher_pack(integer)', 'redeem_wallet_coupon(text)',
    'report_listing(uuid, text)', 'spend_daily_points(integer)', 'spend_network_points(integer)',
    'voucher_packs()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
