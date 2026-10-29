-- FONOMETRO (Audio e Strumenti, piano Plus): il rumore misurato con il
-- microfono del telefono, registro e PDF. Tutto nel browser: niente tabelle.
-- Qui solo l'interruttore dell'Admin: spento (Solo Staff) finché lo Staff non
-- lo accende. Il piano Plus lo controlla anche il database (tool_access legge
-- required_plan da qui).

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('fonometro', false, true, 'base', 'Fonometro – il rumore misurato con il microfono del telefono, registro dei momenti sopra la soglia e PDF; niente registrazioni')
on conflict (tool_name) do nothing;
