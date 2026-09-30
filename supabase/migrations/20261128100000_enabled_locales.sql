-- Lingue attive del sito (Admin → Generale → Lingue del sito). Al lancio:
-- italiano e inglese; le altre restano complete ma nascoste finché lo
-- Staff non le accende. L'italiano è sempre attivo.
insert into public.system_settings (key, value)
values ('enabled_locales', '["it","en"]')
on conflict (key) do nothing;
