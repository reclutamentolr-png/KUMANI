-- KUMANI Webinar: chi presenta può aprire microfono e video a tutti
-- (senza alzare la mano). Ogni persona che parla tiene qui la sua voce e,
-- se l'ha accesa, la sua videocamera.
alter table public.webinars add column if not exists open_mic boolean not null default false;
alter table public.webinar_viewers add column if not exists voice_session text;
alter table public.webinar_viewers add column if not exists voice_track text;
alter table public.webinar_viewers add column if not exists voice_video_track text;
