-- ACCORDATORE (Audio e Strumenti, piano Plus): la nota si riconosce nel
-- telefono al centesimo (chitarra, basso, ukulele, violino, viola,
-- violoncello, cromatico). Tutto nel browser: niente tabelle. Qui solo
-- l'interruttore dell'Admin: spento (Solo Staff) finché lo Staff non lo
-- accende; il piano lo controlla anche il database (tool_access).

insert into public.marketplace_settings (tool_name, is_enabled, staff_preview, required_plan, description)
values ('accordatore', false, true, 'base', 'Accordatore – chitarra, basso, ukulele, violino, viola, violoncello e cromatico, al centesimo, con La regolabile e suono di riferimento; niente registrazioni')
on conflict (tool_name) do nothing;
