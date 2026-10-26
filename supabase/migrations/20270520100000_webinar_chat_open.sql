-- KUMANI Webinar: chi presenta può chiudere e riaprire la chat di chi guarda
alter table public.webinars add column if not exists chat_open boolean not null default true;
