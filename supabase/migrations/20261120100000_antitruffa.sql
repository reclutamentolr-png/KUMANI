-- Manuale "Come difendersi dalle truffe online" (Sicurezza e Verifica,
-- gratis per tutti i Kumani). Solo contenuti statici: nessuna tabella.
insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('antitruffa', true, 'free', 'Manuale Anti-Truffa – come difendersi dalle truffe online')
on conflict (tool_name) do nothing;
