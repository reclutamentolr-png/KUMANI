-- Limiti per persona e pulizia automatica, impostabili dall'Admin
-- (Admin → Limiti e pulizia). Ogni valore sta in app_limits:
-- - count: quante righe può creare una persona (o un viaggio, un menu, una
--   carta) in un servizio;
-- - files: quanti file per persona in uno spazio (bucket) dei file;
-- - keep / days / months: quanto storico tiene la pulizia notturna.
-- I controlli leggono il valore a ogni salvataggio: cambiarlo dall'Admin
-- vale subito, senza migrazioni. Superato il limite il salvataggio è
-- rifiutato con l'errore «app_limit:<chiave>:<massimo>» (l'app lo traduce).

create table if not exists public.app_limits (
  key text primary key,
  value integer not null check (value >= 0 and value <= 10000000),
  kind text not null check (kind in ('count', 'files', 'keep', 'days', 'months')),
  section text not null,
  label text not null,
  sort integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
-- Solo il server (Admin con il client di servizio) e le funzioni qui sotto
alter table public.app_limits enable row level security;

insert into public.app_limits (key, value, kind, section, label, sort) values
  -- KUMANI Casa
  ('casa_homes', 3, 'count', 'KUMANI Casa', 'Case per persona', 10),
  ('casa_utilities', 50, 'count', 'KUMANI Casa', 'Utenze per persona', 11),
  ('casa_appliances', 200, 'count', 'KUMANI Casa', 'Apparecchi per persona', 12),
  ('casa_documents', 300, 'count', 'KUMANI Casa', 'Documenti per persona', 13),
  -- Kumani Garage
  ('garage_cars', 3, 'count', 'Kumani Garage', 'Auto di proprietà per persona', 20),
  ('garage_motorbikes', 3, 'count', 'Kumani Garage', 'Moto di proprietà per persona', 21),
  ('garage_rentals', 2, 'count', 'Kumani Garage', 'Veicoli a noleggio per persona', 22),
  ('garage_deadlines', 200, 'count', 'Kumani Garage', 'Scadenze per persona', 23),
  ('garage_readings', 2000, 'count', 'Kumani Garage', 'Rilevazioni dei km per persona', 24),
  ('garage_expenses', 5000, 'count', 'Kumani Garage', 'Spese per persona', 25),
  ('garage_documents', 100, 'count', 'Kumani Garage', 'Documenti per persona', 26),
  -- MemoLife
  ('memolife_appointments', 2000, 'count', 'MemoLife', 'Appuntamenti per persona', 30),
  ('memolife_tasks', 1000, 'count', 'MemoLife', 'Promemoria per persona', 31),
  ('memolife_notes', 500, 'count', 'MemoLife', 'Note per persona', 32),
  ('memolife_contacts', 1000, 'count', 'MemoLife', 'Contatti per persona', 33),
  -- Life Calendar
  ('lifecal_items', 300, 'count', 'Life Calendar', 'Scadenze attive per persona', 40),
  ('lifecal_profiles', 20, 'count', 'Life Calendar', 'Persone seguite per persona', 41),
  -- Findo
  ('findo_items', 1000, 'count', 'Findo', 'Oggetti per persona', 50),
  ('findo_locations', 200, 'count', 'Findo', 'Posizioni per persona', 51),
  -- Spendly
  ('spendly_income', 3000, 'count', 'Spendly', 'Entrate per persona', 60),
  ('spendly_fixed', 200, 'count', 'Spendly', 'Spese fisse e bollette per persona', 61),
  ('spendly_variable', 10000, 'count', 'Spendly', 'Spese variabili per persona', 62),
  -- Lavoro
  ('quotes', 2000, 'count', 'Preventivi', 'Preventivi per persona', 70),
  ('quote_clients', 1000, 'count', 'Preventivi', 'Clienti salvati per persona', 71),
  ('digital_receipts', 2000, 'count', 'Ricevute digitali', 'Ricevute per persona', 80),
  ('qr_codes', 100, 'count', 'QR Code Pro', 'Codici per persona', 90),
  ('offermaker_campaigns', 100, 'count', 'OfferMaker', 'Campagne per persona', 100),
  ('menu_categories', 40, 'count', 'Menu', 'Categorie per menu', 110),
  ('menu_items', 400, 'count', 'Menu', 'Piatti per menu', 111),
  ('fidelity_members', 5000, 'count', 'Kumi Card', 'Clienti iscritti per carta', 120),
  -- Community e viaggi
  ('listings_active', 20, 'count', 'Bacheca', 'Annunci attivi per persona', 130),
  ('trip_activities', 300, 'count', 'Viaggi', 'Attività per viaggio', 140),
  ('trip_checklist', 200, 'count', 'Viaggi', 'Voci della checklist per viaggio', 141),
  ('trip_expenses', 500, 'count', 'Viaggi', 'Spese per viaggio', 142),
  ('trip_documents', 100, 'count', 'Viaggi', 'Documenti per viaggio', 143),
  -- File per persona in ogni spazio
  ('files_quote-logos-v2', 300, 'files', 'File per persona', 'Logo e immagini dei preventivi', 200),
  ('files_receipt-photos-v2', 2000, 'files', 'File per persona', 'Foto delle ricevute', 201),
  ('files_findo-photos', 1000, 'files', 'File per persona', 'Foto di Findo', 202),
  ('files_cv-photos', 20, 'files', 'File per persona', 'Foto del CV', 203),
  ('files_menu-photos', 500, 'files', 'File per persona', 'Foto del Menu', 204),
  ('files_casa-files', 600, 'files', 'File per persona', 'File di KUMANI Casa', 205),
  ('files_garage-files', 150, 'files', 'File per persona', 'File del Garage', 206),
  -- Pulizia notturna
  ('keep_lifecal_renewals', 50, 'keep', 'Pulizia automatica', 'Storico rinnovi di Life Calendar (ultimi N per scadenza)', 300),
  ('keep_findo_moves', 20, 'keep', 'Pulizia automatica', 'Spostamenti di Findo (ultimi N per oggetto)', 301),
  ('keep_aureya_tests', 50, 'keep', 'Pulizia automatica', 'Test di Aureya (ultimi N per persona)', 302),
  ('days_trial_codes', 365, 'days', 'Pulizia automatica', 'Codici di prova usati, scaduti o revocati (giorni)', 303),
  ('days_chats', 30, 'days', 'Pulizia automatica', 'Chat di Bacheca, Affinity, Kordata e Banca del tempo (giorni)', 304),
  ('days_listings_expired', 90, 'days', 'Pulizia automatica', 'Annunci scaduti della Bacheca (giorni dopo la scadenza)', 305),
  ('days_veritas_rooms', 7, 'days', 'Pulizia automatica', 'Stanze di Veritas (giorni)', 306),
  ('days_tool_points', 30, 'days', 'Pulizia automatica', 'Registro dei KU Karma giornalieri (giorni)', 307),
  ('days_clicks', 90, 'days', 'Pulizia automatica', 'Clic dei QR Code Pro e di OfferMaker (giorni; i totali restano)', 308),
  ('months_inventory_movements', 24, 'months', 'Pulizia automatica', 'Movimenti del Magazzino (mesi)', 309),
  ('months_fidelity_events', 24, 'months', 'Pulizia automatica', 'Timbri e premi della Kumi Card (mesi)', 310),
  ('days_fidelity_claims', 30, 'days', 'Pulizia automatica', 'QR della cassa scaduti della Kumi Card (giorni)', 311),
  ('days_orphan_files', 7, 'days', 'Pulizia automatica', 'File non più usati (foto del CV sostituite, immagini tolte dai preventivi) cancellati dopo (giorni)', 312)
on conflict (key) do nothing;

-- Valore di un limite (null = nessun limite)
create or replace function public.app_limit(p_key text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select value from public.app_limits where key = p_key
$$;
revoke all on function public.app_limit(text) from public, anon, authenticated;

-- Controllo generico per i trigger: argomenti (chiave, colonna su cui
-- contare, filtro facoltativo). Conta le righe già presenti per la stessa
-- persona / viaggio / menu / carta.
create or replace function public.enforce_app_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := tg_argv[0];
  v_col text := tg_argv[1];
  v_filter text := coalesce(tg_argv[2], '');
  v_max integer;
  v_scope text;
  v_count integer;
begin
  v_max := public.app_limit(v_key);
  if v_max is null then
    return new;
  end if;
  v_scope := to_jsonb(new) ->> v_col;
  if v_scope is null then
    return new;
  end if;
  execute format(
    'select count(*) from %I.%I where %I = $1::uuid %s',
    tg_table_schema, tg_table_name, v_col,
    case when v_filter <> '' then 'and (' || v_filter || ')' else '' end
  ) into v_count using v_scope;
  if v_count >= v_max then
    raise exception 'app_limit:%:%', v_key, v_max;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_app_limit() from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('appointments', 'memolife_appointments', 'user_id', ''),
      ('tasks', 'memolife_tasks', 'user_id', ''),
      ('notes', 'memolife_notes', 'user_id', ''),
      ('contacts', 'memolife_contacts', 'user_id', ''),
      ('life_calendar_items', 'lifecal_items', 'user_id', 'status = ''active'''),
      ('life_calendar_profiles', 'lifecal_profiles', 'user_id', ''),
      ('findo_items', 'findo_items', 'user_id', ''),
      ('findo_locations', 'findo_locations', 'user_id', ''),
      ('spendly_income', 'spendly_income', 'user_id', ''),
      ('spendly_fixed_expenses', 'spendly_fixed', 'user_id', ''),
      ('spendly_variable_expenses', 'spendly_variable', 'user_id', ''),
      ('quotes', 'quotes', 'user_id', ''),
      ('quote_clients', 'quote_clients', 'user_id', ''),
      ('digital_receipts', 'digital_receipts', 'user_id', ''),
      ('qr_pro_codes', 'qr_codes', 'user_id', ''),
      ('offermaker_campaigns', 'offermaker_campaigns', 'user_id', ''),
      ('menu_categories', 'menu_categories', 'menu_id', ''),
      ('menu_items', 'menu_items', 'menu_id', ''),
      ('fidelity_members', 'fidelity_members', 'card_id', ''),
      ('listings', 'listings_active', 'user_id', 'is_active and (expires_at is null or expires_at > now())'),
      ('trip_activities', 'trip_activities', 'trip_id', ''),
      ('trip_checklist', 'trip_checklist', 'trip_id', ''),
      ('trip_expenses', 'trip_expenses', 'trip_id', ''),
      ('trip_documents', 'trip_documents', 'trip_id', '')
    ) as t(tbl, lim, col, filter)
  loop
    execute format('drop trigger if exists app_limit_check on public.%I', r.tbl);
    if r.filter = '' then
      execute format('create trigger app_limit_check before insert on public.%I for each row execute function public.enforce_app_limit(%L, %L)', r.tbl, r.lim, r.col);
    else
      execute format('create trigger app_limit_check before insert on public.%I for each row execute function public.enforce_app_limit(%L, %L, %L)', r.tbl, r.lim, r.col, r.filter);
    end if;
  end loop;
end;
$$;

-- KUMANI Casa: stessi controlli di prima, valori da app_limits
create or replace function public.casa_limits_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := case tg_table_name
    when 'casa_homes' then 'casa_homes'
    when 'casa_utilities' then 'casa_utilities'
    when 'casa_appliances' then 'casa_appliances'
    when 'casa_documents' then 'casa_documents'
  end;
  v_max integer := public.app_limit(v_key);
  v_count integer;
begin
  if v_max is null then
    return new;
  end if;
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into v_count using new.user_id;
  if v_count >= v_max then
    raise exception 'app_limit:%:%', v_key, v_max;
  end if;
  return new;
end;
$$;
revoke all on function public.casa_limits_check() from public, anon, authenticated;

-- Kumani Garage: veicoli per tipo (anche al cambio di tipo), poi il resto
create or replace function public.garage_limits_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_max integer;
  v_count integer;
begin
  if tg_table_name = 'garage_vehicles' then
    if new.kind = 'rental' then
      v_key := 'garage_rentals';
      select count(*) into v_count from public.garage_vehicles where user_id = new.user_id and kind = 'rental' and id <> new.id;
    elsif new.vehicle_type = 'motorbike' then
      v_key := 'garage_motorbikes';
      select count(*) into v_count from public.garage_vehicles where user_id = new.user_id and kind = 'owned' and vehicle_type = 'motorbike' and id <> new.id;
    else
      v_key := 'garage_cars';
      select count(*) into v_count from public.garage_vehicles where user_id = new.user_id and kind = 'owned' and vehicle_type = 'car' and id <> new.id;
    end if;
  else
    v_key := case tg_table_name
      when 'garage_readings' then 'garage_readings'
      when 'garage_deadlines' then 'garage_deadlines'
      when 'garage_expenses' then 'garage_expenses'
      when 'garage_documents' then 'garage_documents'
    end;
    execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into v_count using new.user_id;
  end if;
  v_max := public.app_limit(v_key);
  if v_max is not null and v_count >= v_max then
    raise exception 'app_limit:%:%', v_key, v_max;
  end if;
  return new;
end;
$$;
revoke all on function public.garage_limits_check() from public, anon, authenticated;

-- File: quanti per persona in ogni spazio (cartella "<id utente>/…").
-- Vale anche per i caricamenti fatti senza passare dall'app.
create or replace function public.storage_quota_ok(p_bucket text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_max integer := public.app_limit('files_' || p_bucket);
  v_owner text := split_part(p_name, '/', 1);
  v_count integer;
begin
  if v_max is null or v_owner = '' then
    return true;
  end if;
  select count(*) into v_count from storage.objects where bucket_id = p_bucket and name like v_owner || '/%';
  return v_count < v_max;
end;
$$;
revoke all on function public.storage_quota_ok(text, text) from public, anon;
grant execute on function public.storage_quota_ok(text, text) to authenticated;

drop policy if exists app_files_quota on storage.objects;
create policy app_files_quota on storage.objects as restrictive for insert to authenticated
  with check (public.storage_quota_ok(bucket_id, name));

-- File non più usati, da cancellare con le API dello Storage (cron
-- /api/cron/storage-cleanup): foto del CV sostituite e immagini tolte dai
-- preventivi, più vecchie di days_orphan_files giorni.
create or replace function public.storage_orphans(p_limit integer default 500)
returns table (bucket text, name text)
language sql
stable
security definer
set search_path = public, storage
as $$
  with age as (
    select now() - make_interval(days => coalesce(public.app_limit('days_orphan_files'), 7)) as before
  )
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'cv-photos'
     and o.created_at < age.before
     and not exists (select 1 from public.cvs c where c.photo_path = o.name)
   limit p_limit)
  union all
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'quote-logos-v2'
     and o.name like '%/quote-images/%'
     and o.created_at < age.before
     and not exists (select 1 from public.quotes q where q.sections::text like '%' || o.name || '%')
     and not exists (select 1 from public.quote_issuer_profiles p where coalesce(p.quote_presets::text, '') like '%' || o.name || '%')
   limit p_limit)
$$;
revoke all on function public.storage_orphans(integer) from public, anon, authenticated;
grant execute on function public.storage_orphans(integer) to service_role;

-- Pulizia notturna: come prima, con i tempi presi da app_limits, più lo
-- storico dei rinnovi, gli spostamenti di Findo, i test di Aureya e i codici
-- di prova vecchi
create or replace function public.kumani_nightly_cleanup()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chat_days int := coalesce(public.app_limit('days_chats'), 30);
  v_messages int := 0;
  v_affinity int := 0;
  v_convivio int := 0;
  v_timebank int := 0;
  v_listings int := 0;
  v_rooms int := 0;
  v_points int := 0;
  v_qr_clicks int := 0;
  v_offer_clicks int := 0;
  v_movements int := 0;
  v_stamps int := 0;
  v_claims int := 0;
  v_renewals int := 0;
  v_moves int := 0;
  v_aureya int := 0;
  v_trials int := 0;
begin
  begin
    delete from public.messages where created_at < now() - make_interval(days => v_chat_days);
    get diagnostics v_messages = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup messages: %', sqlerrm;
  end;

  begin
    delete from public.affinity_messages where created_at < now() - make_interval(days => v_chat_days);
    get diagnostics v_affinity = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup affinity: %', sqlerrm;
  end;

  begin
    delete from public.convivio_messages where created_at < now() - make_interval(days => v_chat_days);
    get diagnostics v_convivio = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup convivio: %', sqlerrm;
  end;

  -- Non quelle degli scambi contestati
  begin
    delete from public.timebank_messages m
    where m.created_at < now() - make_interval(days => v_chat_days)
      and not exists (select 1 from public.timebank_exchanges e where e.id = m.exchange_id and e.status = 'disputed');
    get diagnostics v_timebank = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup timebank: %', sqlerrm;
  end;

  begin
    delete from public.listings l
    where l.expires_at < now() - make_interval(days => coalesce(public.app_limit('days_listings_expired'), 90))
      and not exists (select 1 from public.messages m where m.listing_id = l.id);
    get diagnostics v_listings = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup listings: %', sqlerrm;
  end;

  begin
    delete from public.veritas_rooms where created_at < now() - make_interval(days => coalesce(public.app_limit('days_veritas_rooms'), 7));
    get diagnostics v_rooms = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup veritas: %', sqlerrm;
  end;

  begin
    delete from public.daily_tool_points where awarded_on < current_date - coalesce(public.app_limit('days_tool_points'), 30);
    get diagnostics v_points = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup points: %', sqlerrm;
  end;

  -- I totali restano nel contatore di ogni codice o campagna
  begin
    delete from public.qr_pro_clicks where created_at < now() - make_interval(days => coalesce(public.app_limit('days_clicks'), 90));
    get diagnostics v_qr_clicks = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup qr clicks: %', sqlerrm;
  end;

  begin
    delete from public.offermaker_clicks where created_at < now() - make_interval(days => coalesce(public.app_limit('days_clicks'), 90));
    get diagnostics v_offer_clicks = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup offermaker clicks: %', sqlerrm;
  end;

  -- La giacenza è nel prodotto
  begin
    delete from public.inventory_movements where created_at < now() - make_interval(months => coalesce(public.app_limit('months_inventory_movements'), 24));
    get diagnostics v_movements = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup inventory: %', sqlerrm;
  end;

  -- I saldi sono nella tessera del cliente
  begin
    delete from public.fidelity_events where created_at < now() - make_interval(months => coalesce(public.app_limit('months_fidelity_events'), 24));
    get diagnostics v_stamps = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup fidelity events: %', sqlerrm;
  end;

  begin
    delete from public.fidelity_claims where expires_at < now() - make_interval(days => coalesce(public.app_limit('days_fidelity_claims'), 30));
    get diagnostics v_claims = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup fidelity claims: %', sqlerrm;
  end;

  -- Storico dei rinnovi di Life Calendar: gli ultimi N per scadenza
  begin
    delete from public.life_calendar_renewals r
    using (
      select id, row_number() over (partition by item_id order by renewed_at desc) as rn
      from public.life_calendar_renewals
    ) x
    where r.id = x.id and x.rn > coalesce(public.app_limit('keep_lifecal_renewals'), 50);
    get diagnostics v_renewals = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup renewals: %', sqlerrm;
  end;

  -- Spostamenti degli oggetti di Findo: gli ultimi N per oggetto
  begin
    delete from public.findo_item_moves m
    using (
      select id, row_number() over (partition by item_id order by moved_at desc) as rn
      from public.findo_item_moves
    ) x
    where m.id = x.id and x.rn > coalesce(public.app_limit('keep_findo_moves'), 20);
    get diagnostics v_moves = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup findo moves: %', sqlerrm;
  end;

  -- Test di Aureya: gli ultimi N per persona
  begin
    delete from public.aureya_test_results t
    using (
      select id, row_number() over (partition by user_id order by created_at desc) as rn
      from public.aureya_test_results
    ) x
    where t.id = x.id and x.rn > coalesce(public.app_limit('keep_aureya_tests'), 50);
    get diagnostics v_aureya = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup aureya: %', sqlerrm;
  end;

  -- Codici di prova chiusi da tempo (usati e finiti, scaduti senza uso, revocati)
  begin
    delete from public.trial_codes
    where coalesce(revoked_at, access_until, activate_by) < now() - make_interval(days => coalesce(public.app_limit('days_trial_codes'), 365))
      and (revoked_at is not null or access_until is not null or (redeemed_at is null and activate_by is not null));
    get diagnostics v_trials = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup trial codes: %', sqlerrm;
  end;

  return jsonb_build_object(
    'messages', v_messages, 'affinity_messages', v_affinity, 'convivio_messages', v_convivio,
    'timebank_messages', v_timebank, 'listings', v_listings, 'veritas_rooms', v_rooms,
    'tool_points', v_points, 'qr_clicks', v_qr_clicks, 'offermaker_clicks', v_offer_clicks,
    'inventory_movements', v_movements, 'fidelity_events', v_stamps, 'fidelity_claims', v_claims,
    'lifecal_renewals', v_renewals, 'findo_moves', v_moves, 'aureya_tests', v_aureya, 'trial_codes', v_trials,
    'at', now()
  );
end;
$function$;
