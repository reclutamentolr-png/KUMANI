-- Avvisi di MemoLife e ora degli avvisi.
-- Appuntamenti: minuti di anticipo (15, 30, 60, 120, 1440 = il giorno prima);
-- di base 1 ora prima.
alter table public.appointments add column if not exists remind_minutes integer[] not null default '{60}';
-- Promemoria: ora dell'avviso (facoltativa, 'HH:MM') e giorni di anticipo
-- (0 = il giorno stesso, 1 = il giorno prima); di base il giorno stesso.
alter table public.tasks add column if not exists remind_time text check (remind_time is null or remind_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.tasks add column if not exists remind_days integer[] not null default '{0}';
-- Ora degli avvisi di scadenze, bollette e promemoria senza ora (vuota = 09:00)
alter table public.push_preferences add column if not exists remind_time text check (remind_time is null or remind_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
