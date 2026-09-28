-- Limiti di piano anche nel database e pagine pubbliche di chi perde il piano.
--
-- 1. Per questi strumenti il controllo "hai il piano giusto e lo strumento è
--    acceso?" c'era solo nell'app: con la chiave pubblica del sito si poteva
--    scrivere direttamente nel database senza abbonamento. Ora creare e
--    modificare richiede can_use_tool (piano + interruttore Admin), come per
--    QR Code Pro e OfferMaker. Leggere e cancellare i propri dati resta sempre
--    possibile (anche a piano scaduto: esportazione, GDPR).
-- 2. Pagine pubbliche:
--    - Link in bio e KUMANI CV: offline appena il piano scade (o lo strumento
--      è spento); tornano online da sole al rinnovo.
--    - Ricevute Digitali: restano visibili fino a 12 mesi dopo la scadenza del
--      piano (sono un documento condiviso con l'altra parte), e sempre se è lo
--      Staff ad aver spento lo strumento.


-- link-in-bio
drop policy if exists link_in_bio_plan_insert on public.link_in_bio;
create policy link_in_bio_plan_insert on public.link_in_bio as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('link-in-bio') t where t.allowed));
drop policy if exists link_in_bio_plan_update on public.link_in_bio;
create policy link_in_bio_plan_update on public.link_in_bio as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('link-in-bio') t where t.allowed));

-- kumani-cv
drop policy if exists cvs_plan_insert on public.cvs;
create policy cvs_plan_insert on public.cvs as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('kumani-cv') t where t.allowed));
drop policy if exists cvs_plan_update on public.cvs;
create policy cvs_plan_update on public.cvs as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('kumani-cv') t where t.allowed));

-- digital-receipt
drop policy if exists digital_receipts_plan_insert on public.digital_receipts;
create policy digital_receipts_plan_insert on public.digital_receipts as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('digital-receipt') t where t.allowed));
drop policy if exists digital_receipts_plan_update on public.digital_receipts;
create policy digital_receipts_plan_update on public.digital_receipts as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('digital-receipt') t where t.allowed));

-- preventivi
drop policy if exists quotes_plan_insert on public.quotes;
create policy quotes_plan_insert on public.quotes as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed));
drop policy if exists quotes_plan_update on public.quotes;
create policy quotes_plan_update on public.quotes as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed));
drop policy if exists quote_clients_plan_insert on public.quote_clients;
create policy quote_clients_plan_insert on public.quote_clients as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed));
drop policy if exists quote_clients_plan_update on public.quote_clients;
create policy quote_clients_plan_update on public.quote_clients as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed));
drop policy if exists quote_issuer_profiles_plan_insert on public.quote_issuer_profiles;
create policy quote_issuer_profiles_plan_insert on public.quote_issuer_profiles as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed));
drop policy if exists quote_issuer_profiles_plan_update on public.quote_issuer_profiles;
create policy quote_issuer_profiles_plan_update on public.quote_issuer_profiles as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed));

-- findo
drop policy if exists findo_items_plan_insert on public.findo_items;
create policy findo_items_plan_insert on public.findo_items as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('findo') t where t.allowed));
drop policy if exists findo_items_plan_update on public.findo_items;
create policy findo_items_plan_update on public.findo_items as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('findo') t where t.allowed));
drop policy if exists findo_locations_plan_insert on public.findo_locations;
create policy findo_locations_plan_insert on public.findo_locations as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('findo') t where t.allowed));
drop policy if exists findo_locations_plan_update on public.findo_locations;
create policy findo_locations_plan_update on public.findo_locations as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('findo') t where t.allowed));
drop policy if exists findo_item_moves_plan_insert on public.findo_item_moves;
create policy findo_item_moves_plan_insert on public.findo_item_moves as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('findo') t where t.allowed));
drop policy if exists findo_item_moves_plan_update on public.findo_item_moves;
create policy findo_item_moves_plan_update on public.findo_item_moves as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('findo') t where t.allowed));

-- life-calendar
drop policy if exists life_calendar_items_plan_insert on public.life_calendar_items;
create policy life_calendar_items_plan_insert on public.life_calendar_items as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('life-calendar') t where t.allowed));
drop policy if exists life_calendar_items_plan_update on public.life_calendar_items;
create policy life_calendar_items_plan_update on public.life_calendar_items as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('life-calendar') t where t.allowed));
drop policy if exists life_calendar_profiles_plan_insert on public.life_calendar_profiles;
create policy life_calendar_profiles_plan_insert on public.life_calendar_profiles as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('life-calendar') t where t.allowed));
drop policy if exists life_calendar_profiles_plan_update on public.life_calendar_profiles;
create policy life_calendar_profiles_plan_update on public.life_calendar_profiles as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('life-calendar') t where t.allowed));
drop policy if exists life_calendar_renewals_plan_insert on public.life_calendar_renewals;
create policy life_calendar_renewals_plan_insert on public.life_calendar_renewals as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('life-calendar') t where t.allowed));
drop policy if exists life_calendar_renewals_plan_update on public.life_calendar_renewals;
create policy life_calendar_renewals_plan_update on public.life_calendar_renewals as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('life-calendar') t where t.allowed));

-- spendly
drop policy if exists spendly_income_plan_insert on public.spendly_income;
create policy spendly_income_plan_insert on public.spendly_income as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));
drop policy if exists spendly_income_plan_update on public.spendly_income;
create policy spendly_income_plan_update on public.spendly_income as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));
drop policy if exists spendly_fixed_expenses_plan_insert on public.spendly_fixed_expenses;
create policy spendly_fixed_expenses_plan_insert on public.spendly_fixed_expenses as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));
drop policy if exists spendly_fixed_expenses_plan_update on public.spendly_fixed_expenses;
create policy spendly_fixed_expenses_plan_update on public.spendly_fixed_expenses as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));
drop policy if exists spendly_fixed_payments_plan_insert on public.spendly_fixed_payments;
create policy spendly_fixed_payments_plan_insert on public.spendly_fixed_payments as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));
drop policy if exists spendly_fixed_payments_plan_update on public.spendly_fixed_payments;
create policy spendly_fixed_payments_plan_update on public.spendly_fixed_payments as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));
drop policy if exists spendly_variable_expenses_plan_insert on public.spendly_variable_expenses;
create policy spendly_variable_expenses_plan_insert on public.spendly_variable_expenses as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));
drop policy if exists spendly_variable_expenses_plan_update on public.spendly_variable_expenses;
create policy spendly_variable_expenses_plan_update on public.spendly_variable_expenses as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));
drop policy if exists bills_plan_insert on public.bills;
create policy bills_plan_insert on public.bills as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));
drop policy if exists bills_plan_update on public.bills;
create policy bills_plan_update on public.bills as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('spendly') t where t.allowed));

-- memolife
drop policy if exists notes_plan_insert on public.notes;
create policy notes_plan_insert on public.notes as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('memolife') t where t.allowed));
drop policy if exists notes_plan_update on public.notes;
create policy notes_plan_update on public.notes as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('memolife') t where t.allowed));
drop policy if exists tasks_plan_insert on public.tasks;
create policy tasks_plan_insert on public.tasks as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('memolife') t where t.allowed));
drop policy if exists tasks_plan_update on public.tasks;
create policy tasks_plan_update on public.tasks as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('memolife') t where t.allowed));
drop policy if exists contacts_plan_insert on public.contacts;
create policy contacts_plan_insert on public.contacts as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('memolife') t where t.allowed));
drop policy if exists contacts_plan_update on public.contacts;
create policy contacts_plan_update on public.contacts as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('memolife') t where t.allowed));
drop policy if exists appointments_plan_insert on public.appointments;
create policy appointments_plan_insert on public.appointments as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('memolife') t where t.allowed));
drop policy if exists appointments_plan_update on public.appointments;
create policy appointments_plan_update on public.appointments as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('memolife') t where t.allowed));

-- menu
drop policy if exists menus_plan_insert on public.menus;
create policy menus_plan_insert on public.menus as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('menu') t where t.allowed));
drop policy if exists menus_plan_update on public.menus;
create policy menus_plan_update on public.menus as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('menu') t where t.allowed));
drop policy if exists menu_items_plan_insert on public.menu_items;
create policy menu_items_plan_insert on public.menu_items as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('menu') t where t.allowed));
drop policy if exists menu_items_plan_update on public.menu_items;
create policy menu_items_plan_update on public.menu_items as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('menu') t where t.allowed));
drop policy if exists menu_categories_plan_insert on public.menu_categories;
create policy menu_categories_plan_insert on public.menu_categories as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('menu') t where t.allowed));
drop policy if exists menu_categories_plan_update on public.menu_categories;
create policy menu_categories_plan_update on public.menu_categories as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('menu') t where t.allowed));

-- aureya
drop policy if exists aureya_test_results_plan_insert on public.aureya_test_results;
create policy aureya_test_results_plan_insert on public.aureya_test_results as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('aureya') t where t.allowed));
drop policy if exists aureya_test_results_plan_update on public.aureya_test_results;
create policy aureya_test_results_plan_update on public.aureya_test_results as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('aureya') t where t.allowed));

-- Link in bio: niente più lettura pubblica diretta dal database (la pagina
-- pubblica /ref/…/bio legge lato server e controlla il piano del titolare).
drop policy if exists "Link in bio is viewable by everyone" on public.link_in_bio;
drop policy if exists public_read_bio on public.link_in_bio;

-- ---------------------------------------------------------------------------
-- Visibilità delle pagine pubbliche
-- ---------------------------------------------------------------------------
create or replace function public.public_page_visible(p_owner uuid, p_tool text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  if exists (select 1 from public.tool_access(p_owner, p_tool) t where t.allowed) then
    return true;
  end if;
  if p_tool = 'digital-receipt' then
    -- Strumento spento dallo Staff: le ricevute restano consultabili
    if not public.tool_online(p_tool) then
      return true;
    end if;
    -- Fino a 12 mesi dopo la fine del piano (o della prova Pro)
    select greatest(coalesce(subscription_expires_at, '-infinity'::timestamptz), coalesce(pro_trial_ends_at, '-infinity'::timestamptz))
      into v_last from public.profiles where id = p_owner;
    return v_last is not null and v_last > now() - interval '1 year';
  end if;
  return false;
end;
$$;
revoke all on function public.public_page_visible(uuid, text) from public, anon, authenticated;

-- Stato di una pagina pubblica: 'ok', 'offline' (esiste ma non è visibile) o
-- 'missing'. Serve alle pagine per dire "non disponibile" invece di "non trovata".
create or replace function public.public_page_status(p_kind text, p_code text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_tool text;
begin
  if p_kind = 'cv' then
    select user_id into v_owner from public.cvs where code = p_code limit 1;
    v_tool := 'kumani-cv';
  elsif p_kind = 'receipt' then
    select user_id into v_owner from public.digital_receipts where code = p_code limit 1;
    v_tool := 'digital-receipt';
  elsif p_kind = 'bio' then
    select id into v_owner from public.profiles where referral_code in (p_code, upper(p_code)) limit 1;
    v_tool := 'link-in-bio';
  else
    return 'missing';
  end if;
  if v_owner is null then
    return 'missing';
  end if;
  return case when public.public_page_visible(v_owner, v_tool) then 'ok' else 'offline' end;
end;
$$;
revoke all on function public.public_page_status(text, text) from public;
grant execute on function public.public_page_status(text, text) to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION get_cv_by_code(p_code TEXT)
RETURNS TABLE (
  code TEXT,
  title TEXT,
  template TEXT,
  content_language TEXT,
  full_name TEXT,
  role_title TEXT,
  summary TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  photo_path TEXT,
  links JSONB,
  experiences JSONB,
  education JSONB,
  skills JSONB,
  languages JSONB,
  certifications JSONB,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    code, title, template, content_language, full_name, role_title, summary,
    email, phone, location, photo_path, links, experiences, education,
    skills, languages, certifications, updated_at
  FROM cvs
  WHERE code = p_code
    AND public.public_page_visible(user_id, 'kumani-cv')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_digital_receipt_by_code(p_code TEXT)
RETURNS TABLE (
  code TEXT,
  template TEXT,
  object_name TEXT,
  serial_number TEXT,
  recipient_name TEXT,
  delivery_date DATE,
  reason TEXT,
  notes TEXT,
  quantity INTEGER,
  declared_value NUMERIC,
  expected_return_date DATE,
  photo_path TEXT,
  confirmed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    code, template, object_name, serial_number, recipient_name, delivery_date,
    reason, notes, quantity, declared_value, expected_return_date, photo_path,
    confirmed_at, returned_at
  FROM digital_receipts
  WHERE code = p_code
    AND public.public_page_visible(user_id, 'digital-receipt')
  LIMIT 1;
$$;
