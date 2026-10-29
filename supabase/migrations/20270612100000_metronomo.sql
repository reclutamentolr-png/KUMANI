-- METRONOMO (Audio e Strumenti, piano Plus): battiti con suono e luce,
-- accelerazione graduale e ascolto dei colpi con il microfono. Tutto nel
-- browser: niente tabelle. Qui solo l'interruttore dell'Admin: spento (Solo
-- Staff) finché lo Staff non lo accende; il piano lo controlla anche il
-- database (tool_access legge required_plan da qui).

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('metronomo', false, true, 'base', 'Metronomo – battiti con suono e luce, accelerazione graduale e ascolto dei colpi per sapere se si va a tempo; niente registrazioni')
on conflict (tool_name) do nothing;
