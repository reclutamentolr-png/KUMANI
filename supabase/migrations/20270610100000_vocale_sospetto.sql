-- VOCALE SOSPETTO? (Sicurezza, gratis): un messaggio vocale si trascrive nel
-- telefono e si controlla con regole anti-truffa (src/lib/voiceScan.ts).
-- Tutto nel browser: niente tabelle. Qui solo l'interruttore dell'Admin:
-- spento (Solo Staff) finché lo Staff non lo accende.

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('vocale-sospetto', false, true, 'free', 'Vocale sospetto? – un messaggio vocale trascritto nel telefono e controllato con le regole anti-truffa; l''audio non lascia il dispositivo')
on conflict (tool_name) do nothing;
