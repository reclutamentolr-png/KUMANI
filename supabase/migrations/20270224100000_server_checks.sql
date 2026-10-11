-- Controlli nel database per i dati scritti dagli utenti: le pagine passano
-- dalle azioni del server, ma con le proprie credenziali si può scrivere
-- direttamente nelle tabelle. Lunghezze massime, numeri sensati, foto solo
-- dalla propria cartella, collegamenti solo a cose proprie.

-- Aggiunge un vincolo se non c'è già (la migrazione si può rieseguire)
create or replace function pg_temp.add_check(p_table text, p_name text, p_expr text)
returns void language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conname = p_name) then
    execute format('alter table public.%I add constraint %I check (%s)', p_table, p_name, p_expr);
  end if;
end $$;

-- Findo
select pg_temp.add_check('findo_items', 'findo_items_limits_check',
  $c$char_length(name) <= 120 and char_length(coalesce(category, '')) <= 60
     and coalesce(cardinality(tags), 0) <= 20 and char_length(coalesce(array_to_string(tags, ','), '')) <= 600$c$);
select pg_temp.add_check('findo_items', 'findo_items_photo_own_check',
  $c$photo_path is null or photo_path like user_id::text || '/%'$c$);
select pg_temp.add_check('findo_locations', 'findo_locations_limits_check',
  $c$char_length(name) <= 100 and char_length(coalesce(icon, '')) <= 40$c$);

-- Life Calendar
select pg_temp.add_check('life_calendar_items', 'life_calendar_items_limits_check',
  $c$char_length(title) <= 160 and char_length(coalesce(notes, '')) <= 2000
     and (reminder_offsets is null or (cardinality(reminder_offsets) <= 10 and 0 <= all(reminder_offsets) and 730 >= all(reminder_offsets)))
     and (recurrence_custom_days is null or recurrence_custom_days between 1 and 3650)$c$);
select pg_temp.add_check('life_calendar_profiles', 'life_calendar_profiles_limits_check',
  $c$char_length(name) <= 60 and char_length(coalesce(icon, '')) <= 40$c$);

-- Ricevute Digitali
select pg_temp.add_check('digital_receipts', 'digital_receipts_limits_check',
  $c$char_length(object_name) <= 160 and char_length(coalesce(serial_number, '')) <= 100
     and char_length(coalesce(recipient_name, '')) <= 120 and char_length(coalesce(reason, '')) <= 500
     and char_length(coalesce(notes, '')) <= 2000
     and (quantity is null or quantity between 1 and 100000)
     and (declared_value is null or declared_value between 0 and 10000000)
     and (expected_return_date is null or delivery_date is null or expected_return_date >= delivery_date)$c$);
select pg_temp.add_check('digital_receipts', 'digital_receipts_photo_own_check',
  $c$photo_path is null or photo_path like user_id::text || '/%'$c$);

-- KUMANI CV
select pg_temp.add_check('cvs', 'cvs_limits_check',
  $c$char_length(coalesce(title, '')) <= 120 and char_length(coalesce(full_name, '')) <= 120
     and char_length(coalesce(role_title, '')) <= 160 and char_length(coalesce(summary, '')) <= 3000
     and char_length(coalesce(email, '')) <= 200 and char_length(coalesce(phone, '')) <= 40
     and char_length(coalesce(location, '')) <= 120 and char_length(coalesce(content_language, '')) <= 10
     and char_length(coalesce(links::text, '')) <= 10000 and char_length(coalesce(experiences::text, '')) <= 60000
     and char_length(coalesce(education::text, '')) <= 30000 and char_length(coalesce(skills::text, '')) <= 10000
     and char_length(coalesce(languages::text, '')) <= 5000 and char_length(coalesce(certifications::text, '')) <= 20000$c$);
select pg_temp.add_check('cvs', 'cvs_photo_own_check',
  $c$photo_path is null or photo_path like user_id::text || '/%'$c$);

-- Link in Bio
select pg_temp.add_check('link_in_bio', 'link_in_bio_limits_check',
  $c$char_length(coalesce(bio_text, '')) <= 500 and char_length(coalesce(theme, '')) <= 40
     and char_length(coalesce(links::text, '')) <= 20000$c$);

-- Preventivi
select pg_temp.add_check('quotes', 'quotes_limits_check',
  $c$char_length(coalesce(client_name, '')) <= 200 and char_length(coalesce(client_email, '')) <= 200
     and char_length(coalesce(client_phone, '')) <= 60 and char_length(coalesce(client_address, '')) <= 300
     and char_length(coalesce(client_vat, '')) <= 40 and char_length(coalesce(client_city, '')) <= 120
     and char_length(coalesce(client_postal_code, '')) <= 20 and char_length(coalesce(client_pec, '')) <= 200
     and char_length(coalesce(notes, '')) <= 3000 and char_length(coalesce(payment_info, '')) <= 2000
     and char_length(coalesce(items::text, '')) <= 100000 and char_length(coalesce(sections::text, '')) <= 200000
     and total >= 0$c$);

-- Collegamenti solo a cose proprie: la stanza di Findo, la stanza «madre»
-- e il profilo di Life Calendar devono essere della stessa persona
create or replace function public.check_own_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_ok boolean;
begin
  if v_ref is null then
    return new;
  end if;
  -- EXECUTE non aggiorna FOUND: il risultato si legge con INTO
  execute format('select exists (select 1 from public.%I where id = $1 and user_id = $2)', tg_argv[1]) into v_ok using v_ref, new.user_id;
  if not coalesce(v_ok, false) then
    raise exception 'not_own_reference' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.check_own_reference() from public, anon, authenticated;

drop trigger if exists findo_items_own_location on public.findo_items;
create trigger findo_items_own_location before insert or update of location_id on public.findo_items
  for each row execute function public.check_own_reference('location_id', 'findo_locations');
drop trigger if exists findo_locations_own_parent on public.findo_locations;
create trigger findo_locations_own_parent before insert or update of parent_id on public.findo_locations
  for each row execute function public.check_own_reference('parent_id', 'findo_locations');
drop trigger if exists life_calendar_items_own_profile on public.life_calendar_items;
create trigger life_calendar_items_own_profile before insert or update of profile_id on public.life_calendar_items
  for each row execute function public.check_own_reference('profile_id', 'life_calendar_profiles');

-- Pulizia notturna: anche le foto di Findo e delle Ricevute caricate e poi
-- lasciate («Annulla» o pagina chiusa) senza nessun oggetto che le usi
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
  union all
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'findo-photos'
     and o.created_at < age.before
     and not exists (select 1 from public.findo_items f where f.photo_path = o.name)
   limit p_limit)
  union all
  (select o.bucket_id::text, o.name
   from storage.objects o, age
   where o.bucket_id = 'receipt-photos-v2'
     and o.created_at < age.before
     and not exists (select 1 from public.digital_receipts r where r.photo_path = o.name)
   limit p_limit)
$$;
revoke all on function public.storage_orphans(integer) from public, anon, authenticated;
grant execute on function public.storage_orphans(integer) to service_role;
