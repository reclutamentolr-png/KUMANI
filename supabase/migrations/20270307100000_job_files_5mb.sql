-- Foto e documenti dei lavori: al massimo 5 MB per file (le foto arrivano già
-- compresse dal browser a 150–300 KB; il limite pesa solo sui PDF).
update storage.buckets set file_size_limit = 5242880 where id = 'job-files';
alter table public.job_files drop constraint if exists job_files_size_check;
alter table public.job_files add constraint job_files_size_check check (size > 0 and size <= 5242880) not valid;
