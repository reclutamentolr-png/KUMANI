-- Bonus Struttura solo per lo spillover: il posto in matrice riempito da un
-- proprio invitato dà già i Punti Community dell'attivazione (Base 49 /
-- Pro 122), quindi il bonus "per posto diretto" sarebbe un doppione e va a 0.
-- Resta il bonus per i posti riempiti da persone invitate da altri
-- (matrix_spillover_bonus_points, 5).
update public.system_settings set value = '0' where key = 'matrix_slot_bonus_points';
insert into public.system_settings (key, value) values ('matrix_slot_bonus_points', '0')
on conflict (key) do nothing;
