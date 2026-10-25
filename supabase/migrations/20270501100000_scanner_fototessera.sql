-- SCANNER E PDF (piano Pro) e FOTOTESSERA (piano Plus): tutto nel browser,
-- niente tabelle e niente file sul server. Qui solo gli interruttori
-- dell'Admin: spenti (Solo Staff) finché lo Staff non li accende.

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values
  ('scanner', false, true, 'pro', 'Scanner e PDF – foto dei documenti raddrizzate e pulite, unione, divisione, rotazione e compressione dei PDF; tutto nel browser'),
  ('fototessera', false, true, 'base', 'Fototessera – foto 35×45 mm con sfondo bianco e testa della misura giusta, più foglio 10×15 da stampare; tutto nel browser')
on conflict (tool_name) do nothing;
