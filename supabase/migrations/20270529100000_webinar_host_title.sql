-- KUMANI Webinar: il ruolo di chi presenta accanto al nome (es. «Founder
-- KUMANI»), nella pagina dell'invito, in chat e negli avvisi
alter table public.webinars add column if not exists host_title text check (host_title is null or char_length(host_title) <= 60);
