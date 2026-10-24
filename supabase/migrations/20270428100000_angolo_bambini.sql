-- Angolo Bambini (piano Plus): disegni da colorare che, finiti, si animano e
-- fanno i complimenti al bambino. Niente IA e niente dati sul server: nome ed
-- età dei bambini, codice del genitore e disegni restano nel telefono. Qui
-- solo l'interruttore dell'Admin: spento (Solo Staff) finché lo Staff non lo
-- accende.

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('angolo-bambini', false, true, 'base', 'Angolo Bambini – colorare e animare i disegni (19 figure), con il codice del genitore; tutto resta nel telefono')
on conflict (tool_name) do nothing;
