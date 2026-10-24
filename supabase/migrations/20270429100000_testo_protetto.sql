-- TESTO PROTETTO (piano Plus): prima di usare un testo con un'IA, i dati
-- personali diventano etichette neutre ([PERSONA 1], [IBAN 1]…) e tornano
-- nella risposta. Tutto nel browser: niente tabelle, niente dati sul server.
-- Qui solo l'interruttore dell'Admin: spento (Solo Staff) finché lo Staff non
-- lo accende.

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('testo-protetto', false, true, 'base', 'Testo Protetto – dati personali sostituiti con etichette neutre prima di usare un testo con l''IA, poi rimessi nella risposta; tutto nel browser')
on conflict (tool_name) do nothing;
