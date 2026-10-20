-- Sicurezza del database (consigli di Supabase, 20/10/2026)

-- 1. Percorso di ricerca fisso: una funzione non può essere ingannata da
--    tabelle o funzioni con lo stesso nome create altrove
alter function public.event_end(events) set search_path = public, extensions;
alter function public.event_validate(jsonb) set search_path = public, extensions;
alter function public.fabula_roll(date) set search_path = public, extensions;
alter function public.fabula_today() set search_path = public, extensions;
alter function public.find_spillover_position(uuid) set search_path = public, extensions;
alter function public.generate_referral_code(character) set search_path = public, extensions;
alter function public.get_direct_recruiter_leaderboard(integer) set search_path = public, extensions;
alter function public.get_public_latest_users(integer) set search_path = public, extensions;
alter function public.get_total_structure_leaderboard(integer) set search_path = public, extensions;
alter function public.get_unread_messages_for_me() set search_path = public, extensions;
alter function public.get_user_downline(uuid,integer) set search_path = public, extensions;
alter function public.get_user_rankings(uuid) set search_path = public, extensions;
alter function public.profile_fields_complete(profiles) set search_path = public, extensions;
alter function public.quote_gross(numeric,text,numeric) set search_path = public, extensions;
alter function public.quotes_guard_payment() set search_path = public, extensions;
alter function public.quotes_reset_payment() set search_path = public, extensions;
alter function public.register_user_with_matrix(uuid,text,text,text,text,date,text,character,text,text,text,text) set search_path = public, extensions;
alter function public.sec_rank(text) set search_path = public, extensions;
alter function public.spendly_bill_step(text) set search_path = public, extensions;
alter function public.timebank_categories() set search_path = public, extensions;
alter function public.timebank_clean_array(jsonb,text[]) set search_path = public, extensions;
alter function public.update_updated_at() set search_path = public, extensions;
alter function public.valid_brand_colors(jsonb) set search_path = public, extensions;
alter function public.valid_brand_follow(jsonb) set search_path = public, extensions;
alter function public.verifoto_month() set search_path = public, extensions;
alter function public.veritas_hash(text) set search_path = public, extensions;

-- 2. Funzioni che scattano da sole (trigger): nessuno deve poterle richiamare
--    dall'esterno. Continuano a funzionare come prima.
revoke execute on function public.affinity_intros_signal() from public, anon, authenticated;
revoke execute on function public.affinity_messages_signal() from public, anon, authenticated;
revoke execute on function public.convivio_fee_on_order() from public, anon, authenticated;
revoke execute on function public.convivio_fee_percent_on_confirm() from public, anon, authenticated;
revoke execute on function public.inventory_sync_menu_availability() from public, anon, authenticated;
revoke execute on function public.job_limits_check() from public, anon, authenticated;
revoke execute on function public.menu_items_check_inventory() from public, anon, authenticated;
revoke execute on function public.messages_rate_limit() from public, anon, authenticated;
revoke execute on function public.skip_duplicate_open_report() from public, anon, authenticated;
revoke execute on function public.trip_check_member_ref() from public, anon, authenticated;
revoke execute on function public.trip_check_money_refs() from public, anon, authenticated;
revoke execute on function public.trip_touch() from public, anon, authenticated;
revoke execute on function public.trips_set_code() from public, anon, authenticated;
