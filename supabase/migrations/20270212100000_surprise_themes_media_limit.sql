-- KUMANI Sorpresa: 5 colori in più (corallo, rubino, lilla, turchese, argento)
alter table public.surprise_gifts drop constraint if exists surprise_gifts_theme_check;
alter table public.surprise_gifts add constraint surprise_gifts_theme_check
  check (theme in ('gold', 'rose', 'sky', 'green', 'night', 'coral', 'ruby', 'lilac', 'teal', 'silver'));

-- Foto, video e audio: al massimo 10 MB ciascuno (il browser li comprime
-- prima di caricarli; questo è il limite che vale comunque)
update storage.buckets set file_size_limit = 10485760 where id = 'surprise-media';
