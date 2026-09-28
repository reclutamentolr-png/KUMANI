-- VeriFoto: un'analisi del rilevatore AI al giorno per utente (prima 3), così
-- la quota gratuita mensile di Sightengine basta per più persone. Resta
-- modificabile da Admin → Impostazioni.
update public.system_settings set value = '1' where key = 'verifoto_daily_user' and value in ('3', '"3"');
insert into public.system_settings (key, value) values ('verifoto_daily_user', '1') on conflict (key) do nothing;
